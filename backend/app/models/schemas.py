from __future__ import annotations

from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


class NavigateRequest(BaseModel):
    url: str
    session_id: str = "default"

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("URL must use http or https scheme")
        if not parsed.netloc:
            raise ValueError("URL must include a host")
        return v


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


class InteractRequest(BaseModel):
    session_id: str = "default"
    action: Literal["click", "type", "scroll"]
    # Normalised coordinates in [0,1] range relative to the 1280x720 viewport
    x: float = Field(default=0.0, ge=0.0, le=1.0)
    y: float = Field(default=0.0, ge=0.0, le=1.0)
    text: str = Field(default="", max_length=10_000)  # used for "type" action
    delta_y: int = Field(default=0, ge=-10_000, le=10_000)  # scroll pixels, used for "scroll" action


class InteractResponse(BaseModel):
    status: str
    current_url: str


class ResetSessionResponse(BaseModel):
    status: str
    session_id: str
