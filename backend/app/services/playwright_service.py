"""Session-based Playwright manager with deterministic network analysis."""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional
from urllib.parse import urlparse

from playwright.async_api import Browser, BrowserContext, Page, Playwright, Response, async_playwright
import sys

from app.services.analysis_service import score_response

logger = logging.getLogger(__name__)

MAX_REQUESTS = 200
DEFAULT_SESSION_ID = "default"

BroadcastFn = Callable[[dict[str, Any]], Awaitable[None]]


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


def set_broadcast_handler(handler: BroadcastFn) -> None:
    global _broadcast
    _broadcast = handler


async def _emit(event: dict[str, Any]) -> None:
    if _broadcast:
        await _broadcast(event)


async def start_browser() -> None:
    global _playwright, _browser
    if _browser is not None:
        return
    # On Windows, the default selector event loop may not support subprocesses.
    # Ensure a ProactorEventLoopPolicy is used so Playwright can spawn its browser subprocess.
    if sys.platform == "win32":
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        except Exception:
            # If setting the policy fails for any reason, continue and let Playwright raise a clear error.
            logger.debug("Could not set WindowsProactorEventLoopPolicy; proceeding anyway")

    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(headless=True)
    await start_session(DEFAULT_SESSION_ID)
    logger.info("Browser service started")


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


async def _handle_response(session_id: str, response: Response) -> None:
    state = _sessions.get(session_id)
    if not state:
        return

    headers = response.headers
    content_type = headers.get("content-type", "").lower()
    if "application/json" not in content_type:
        return

    parsed_body = None
    try:
        parsed_body = await response.json()
    except Exception:  # noqa: BLE001
        return

    request = response.request
    state.sequence += 1
    score = score_response(parsed_body)

    item = {
        "id": f"{session_id}-{state.sequence}",
        "session_id": session_id,
        "url": response.url,
        "path": urlparse(response.url).path,
        "method": request.method,
        "status": response.status,
        "headers": headers,
        "content_type": content_type,
        "size": len(str(parsed_body)),
        "json": parsed_body,
        "score": score["score"],
        "signals": score["signals"],
        "data_path": score["data_path"],
    }
    state.requests.appendleft(item)

    await _emit({"type": "request_captured", "request": {k: v for k, v in item.items() if k != "json"}})
