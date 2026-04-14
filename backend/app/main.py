"""FastAPI application entry-point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.services import playwright_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await playwright_service.start_browser()
    yield
    await playwright_service.stop_browser()


app = FastAPI(title="Scraping Assistant API", lifespan=lifespan)

# ---------------------------------------------------------------------------
# CORS – allow the Next.js dev server (and any origin during development)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
_active_connections: list[WebSocket] = []


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _active_connections.append(websocket)
    logger.info("WebSocket client connected")
    try:
        while True:
            data = await websocket.receive_text()
            logger.info("WS received: %s", data)
            await websocket.send_text(f"echo: {data}")
    except WebSocketDisconnect:
        _active_connections.remove(websocket)
        logger.info("WebSocket client disconnected")
