"""FastAPI application entry-point."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager

# Must be set at module-import time, before uvicorn creates the event loop.
# The reload worker subprocess imports this module first, then creates its loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services import playwright_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CORS origins
# ---------------------------------------------------------------------------
# Set ALLOWED_ORIGINS to a comma-separated list of trusted origins.
# Example: ALLOWED_ORIGINS=http://localhost:3000,https://myapp.example.com
# Defaults to localhost:3000 (the default Next.js dev server) when not set.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    or ["http://localhost:3000"]
)

_active_connections: list[WebSocket] = []


async def broadcast(event: dict):
    dead: list[WebSocket] = []
    payload = json.dumps(event)
    for ws in list(_active_connections):
        try:
            await ws.send_text(payload)
        except Exception as exc:
            logger.debug("WebSocket send failed, dropping connection: %s", exc)
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
    allow_origins=ALLOWED_ORIGINS,
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
    # When API_KEY is configured, require it via the ?api_key= query parameter.
    configured_key = os.environ.get("API_KEY", "")
    if configured_key:
        supplied = (
            websocket.query_params.get("api_key")
            or websocket.headers.get("x-api-key")
        )
        if supplied != configured_key:
            await websocket.close(code=1008)  # Policy Violation
            logger.warning("WebSocket connection rejected: invalid API key")
            return

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
