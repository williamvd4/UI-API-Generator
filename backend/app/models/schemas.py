from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class NavigateRequest(BaseModel):
    url: str
    session_id: str = "default"


class NavigateResponse(BaseModel):
    status: str
    url: str
    session_id: str


class RequestsResponse(BaseModel):
    session_id: str
    requests: list[dict[str, Any]]


class GenerateConfigRequest(BaseModel):
    request_id: str
    session_id: str = "default"


class GenerateConfigResponse(BaseModel):
    config: dict[str, Any]


class RequestDetailResponse(BaseModel):
    request: dict[str, Any] = Field(description="Captured request including parsed JSON body")
