"""FastAPI application entry-point."""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services import playwright_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    playwright_service.set_broadcast_handler(broadcast)
    await playwright_service.start_browser()
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
