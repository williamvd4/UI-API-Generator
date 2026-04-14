"""FastAPI application entry-point."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
<<<<<<< HEAD
import asyncio
=======
>>>>>>> 901f605f7f5043c7b7f1c5699efc4300e43f8bce
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services import playwright_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure Proactor event loop on Windows so subprocesses work (Playwright needs this)
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        # Best-effort; if this fails, Playwright startup will raise a descriptive error
        pass

_active_connections: list[WebSocket] = []


async def broadcast(event: dict):
    dead: list[WebSocket] = []
    for ws in _active_connections:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        if ws in _active_connections:
            _active_connections.remove(ws)


def configure_event_loop_for_windows() -> None:
    """Prefer Proactor loop on Windows for subprocess support (Playwright)."""
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsProactorEventLoopPolicy"):
        policy = asyncio.get_event_loop_policy()
        if not isinstance(policy, asyncio.WindowsProactorEventLoopPolicy):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


configure_event_loop_for_windows()

_active_connections: list[WebSocket] = []


async def broadcast(event: dict):
    dead: list[WebSocket] = []
    payload = json.dumps(event)
    for ws in list(_active_connections):
        try:
            await ws.send_text(payload)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        if ws in _active_connections:
            _active_connections.remove(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    playwright_service.set_broadcast_handler(broadcast)
    await playwright_service.start_browser()
    if playwright_service.get_startup_error():
        logger.warning("Playwright unavailable at startup: %s", playwright_service.get_startup_error())
    yield
    await playwright_service.stop_browser()


app = FastAPI(title="Scraping Assistant API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/")
async def root():
    return {"message": "Scraping Assistant API is running"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _active_connections.append(websocket)
    await websocket.send_text(json.dumps({"type": "connected"}))
    logger.info("WebSocket client connected")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in _active_connections:
            _active_connections.remove(websocket)
        logger.info("WebSocket client disconnected")
