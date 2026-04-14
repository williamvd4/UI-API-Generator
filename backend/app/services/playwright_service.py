"""Playwright browser service – launches a browser and exposes navigation."""

import logging
from typing import Optional

from playwright.async_api import async_playwright, Browser, Page, Response

logger = logging.getLogger(__name__)

_browser: Optional[Browser] = None
_page: Optional[Page] = None


async def start_browser() -> None:
    """Launch a Chromium browser instance."""
    global _browser, _page
    pw = await async_playwright().start()
    _browser = await pw.chromium.launch(headless=True)
    _page = await _browser.new_page()
    _page.on("response", _handle_response)
    logger.info("Browser started")


async def stop_browser() -> None:
    """Close the browser instance."""
    global _browser, _page
    if _browser:
        await _browser.close()
        _browser = None
        _page = None
    logger.info("Browser stopped")


async def navigate(url: str) -> str:
    """Navigate the page to *url* and return the final URL."""
    if _page is None:
        raise RuntimeError("Browser not started")
    response = await _page.goto(url, wait_until="domcontentloaded")
    final_url = _page.url
    logger.info("Navigated to %s (status %s)", final_url, response.status if response else "?")
    return final_url


def _handle_response(response: Response) -> None:
    """Log every HTTP response captured by Playwright."""
    content_type = response.headers.get("content-type", "unknown")
    logger.info(
        "NETWORK  %s  %s  %s",
        response.status,
        content_type,
        response.url,
    )
