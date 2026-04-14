from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.models.schemas import (
    GenerateConfigRequest,
    GenerateConfigResponse,
    NavigateRequest,
    NavigateResponse,
    RequestDetailResponse,
    RequestsResponse,
)
from app.services import playwright_service
from app.services.analysis_service import generate_config

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "playwright_ready": playwright_service.get_startup_error() is None,
        "playwright_error": playwright_service.get_startup_error(),
    }


@router.post("/navigate", response_model=NavigateResponse)
async def navigate(payload: NavigateRequest):
    try:
        final_url = await playwright_service.navigate(payload.session_id, payload.url)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    final_url = await playwright_service.navigate(payload.session_id, payload.url)
    return NavigateResponse(status="ok", url=final_url, session_id=payload.session_id)


@router.get("/requests", response_model=RequestsResponse)
async def get_requests(session_id: str = Query(default="default")):
    requests = [
        {k: v for k, v in item.items() if k != "json"}
        for item in playwright_service.get_requests(session_id)
    ]
    return RequestsResponse(session_id=session_id, requests=requests)


@router.get("/request/{request_id}", response_model=RequestDetailResponse)
async def get_request_detail(request_id: str, session_id: str = Query(default="default")):
    request = playwright_service.get_request_by_id(session_id, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return RequestDetailResponse(request=request)


@router.post("/generate-config", response_model=GenerateConfigResponse)
async def generate_config_endpoint(payload: GenerateConfigRequest):
    request = playwright_service.get_request_by_id(payload.session_id, payload.request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    urls = [entry["url"] for entry in playwright_service.get_requests(payload.session_id)]
    config = generate_config(request, request.get("json"), urls)
    return GenerateConfigResponse(config=config)


@router.get("/screenshot")
async def screenshot(session_id: str = Query(default="default")):
    try:
        png = await playwright_service.get_screenshot(session_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    png = await playwright_service.get_screenshot(session_id)
    return Response(content=png, media_type="image/png")
