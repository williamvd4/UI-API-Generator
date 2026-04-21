"""Session-based Playwright manager with deterministic network analysis."""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional
from urllib.parse import urlparse

from playwright.async_api import Browser, BrowserContext, Page, Playwright, Response, async_playwright

from app.services.analysis_service import score_response

logger = logging.getLogger(__name__)

MAX_REQUESTS = 200
MAX_JSON_BYTES = 512 * 1024  # 512 KB – skip JSON parsing for larger responses
DEFAULT_SESSION_ID = "default"

BroadcastFn = Callable[[dict[str, Any]], Awaitable[None]]

# Headers whose values are redacted before the request item is stored, to avoid
# accidentally leaking credentials into the network log or WebSocket events.
_SENSITIVE_HEADERS: frozenset[str] = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "proxy-authorization",
        "x-api-key",
        "x-auth-token",
        "x-csrf-token",
    }
)


def _redact_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        k: ("[redacted]" if k.lower() in _SENSITIVE_HEADERS else v)
        for k, v in headers.items()
    }


@dataclass
class SessionState:
    context: BrowserContext
    page: Page
    requests: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=MAX_REQUESTS))
    sequence: int = 0


_playwright: Optional[Playwright] = None
_browser: Optional[Browser] = None
_sessions: dict[str, SessionState] = {}
_broadcast: Optional[BroadcastFn] = None
_startup_error: Optional[str] = None


def set_broadcast_handler(handler: BroadcastFn) -> None:
    global _broadcast
    _broadcast = handler


async def _emit(event: dict[str, Any]) -> None:
    if _broadcast:
        await _broadcast(event)


def get_startup_error() -> Optional[str]:
    return _startup_error


async def ensure_browser() -> None:
    """Start Playwright lazily; raises RuntimeError with actionable guidance if unavailable."""
    if _browser is None:
        await start_browser()
    if _browser is None:
        message = _startup_error or "Playwright could not be started."
        raise RuntimeError(message)


async def start_browser() -> None:
    global _playwright, _browser, _startup_error
    if _browser is not None:
        return

    try:
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(headless=True)
        _startup_error = None
        await start_session(DEFAULT_SESSION_ID)
        logger.info("Browser service started")
    except Exception as exc:  # noqa: BLE001
        _startup_error = (
            "Failed to initialize Playwright browser. Ensure Python 3.13 or lower is used on Windows, "
            "install Playwright browsers with 'playwright install', then restart. "
            f"Original error: {exc}"
        )
        logger.exception("Playwright startup failed")


async def stop_browser() -> None:
    global _browser, _playwright
    for session in list(_sessions.values()):
        await session.context.close()
    _sessions.clear()
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
    logger.info("Browser service stopped")


async def start_session(session_id: str) -> None:
    await ensure_browser()
    if _browser is None:
        raise RuntimeError("Browser not started")
    if session_id in _sessions:
        return
    context = await _browser.new_context(viewport={"width": 1280, "height": 720})
    page = await context.new_page()
    state = SessionState(context=context, page=page)
    _sessions[session_id] = state
    page.on("response", lambda response: asyncio.create_task(_handle_response(session_id, response)))
    logger.info("Session started: %s", session_id)


async def navigate(session_id: str, url: str) -> str:
    if session_id not in _sessions:
        await start_session(session_id)
    state = _sessions[session_id]
    response = await state.page.goto(url, wait_until="domcontentloaded")
    await _emit({
        "type": "navigation",
        "session_id": session_id,
        "url": state.page.url,
        "status": response.status if response else None,
    })
    return state.page.url


async def get_screenshot(session_id: str) -> bytes:
    if session_id not in _sessions:
        await start_session(session_id)
    return await _sessions[session_id].page.screenshot(type="png")


def get_requests(session_id: str) -> list[dict[str, Any]]:
    state = _sessions.get(session_id)
    return list(state.requests) if state else []


def get_request_by_id(session_id: str, request_id: str) -> Optional[dict[str, Any]]:
    for item in get_requests(session_id):
        if item["id"] == request_id:
            return item
    return None


async def reset_session(session_id: str) -> None:
    """Clear captured requests and navigate to about:blank for a session.

    Creates a fresh session if one does not yet exist.
    """
    state = _sessions.get(session_id)
    if state:
        state.requests.clear()
        state.sequence = 0
        try:
            await state.page.goto("about:blank", wait_until="commit")
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Could not navigate to about:blank during session reset for %s: %s",
                session_id,
                exc,
            )
    logger.info("Session reset: %s", session_id)


# Viewport dimensions kept in sync with context creation below
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720


async def interact(session_id: str, action: str, x: float, y: float, text: str = "", delta_y: int = 0) -> str:
    """Perform a click, type, or scroll action in the browser and return the current URL."""
    if session_id not in _sessions:
        await start_session(session_id)
    state = _sessions[session_id]
    page = state.page

    if action == "click":
        abs_x = x * VIEWPORT_WIDTH
        abs_y = y * VIEWPORT_HEIGHT
        await page.mouse.click(abs_x, abs_y)
        # Wait briefly for any navigation/network
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Load state wait timed out after click in session %s: %s", session_id, exc)
    elif action == "type":
        await page.keyboard.type(text)
    elif action == "scroll":
        abs_x = x * VIEWPORT_WIDTH
        abs_y = y * VIEWPORT_HEIGHT
        await page.mouse.wheel(0, delta_y)
    else:
        raise ValueError(f"Unknown interact action: {action!r}")

    await _emit({"type": "navigation", "session_id": session_id, "url": page.url})
    return page.url


async def _handle_response(session_id: str, response: Response) -> None:
    state = _sessions.get(session_id)
    if not state:
        return

    request = response.request
    headers = request.headers
    content_type = response.headers.get("content-type", "").lower()

    parsed_body = None
    score_result: dict[str, Any] = {"score": 0.0, "signals": [], "data_path": "data"}
    if "application/json" in content_type:
        raw_size = int(headers.get("content-length", 0) or 0)
        if raw_size == 0 or raw_size <= MAX_JSON_BYTES:
            try:
                parsed_body = await response.json()
                score_result = score_response(parsed_body)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Failed to parse JSON response from %s: %s", response.url, exc)
        else:
            logger.debug(
                "Skipping JSON parse for large response (%d bytes) from %s",
                raw_size,
                response.url,
            )

    state.sequence += 1
    item = {
        "id": f"{session_id}-{state.sequence}",
        "session_id": session_id,
        "url": response.url,
        "path": urlparse(response.url).path,
        "method": request.method,
        "status": response.status,
        "headers": _redact_headers(dict(headers)),
        "content_type": content_type,
        "resource_type": request.resource_type,
        "size": len(str(parsed_body)) if parsed_body is not None else int(headers.get("content-length", 0) or 0),
        "json": parsed_body,
        "score": score_result["score"],
        "signals": score_result["signals"],
        "data_path": score_result["data_path"],
    }
    state.requests.appendleft(item)

    await _emit({"type": "request_captured", "request": {k: v for k, v in item.items() if k != "json"}})
