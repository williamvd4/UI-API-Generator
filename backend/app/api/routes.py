from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.models.schemas import NavigateRequest, NavigateResponse
from app.services import playwright_service

router = APIRouter()


@router.post("/navigate", response_model=NavigateResponse)
async def navigate(payload: NavigateRequest):
    """Tell Playwright to navigate to the given URL."""
    final_url = await playwright_service.navigate(payload.url)
    return NavigateResponse(status="ok", url=final_url)
