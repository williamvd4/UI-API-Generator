"""API key authentication dependency.

When the ``API_KEY`` environment variable is set, every protected endpoint
requires the matching value in the ``X-Api-Key`` request header.  When the
variable is not set (the default), authentication is disabled so that local
development works out of the box without any configuration.
"""

from __future__ import annotations

import os

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

_API_KEY_HEADER = APIKeyHeader(name="X-Api-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(_API_KEY_HEADER)) -> None:
    """FastAPI dependency that enforces API key auth when ``API_KEY`` is set."""
    configured = os.environ.get("API_KEY", "")
    if not configured:
        return  # auth disabled
    if api_key != configured:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
