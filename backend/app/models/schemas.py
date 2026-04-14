from pydantic import BaseModel


class NavigateRequest(BaseModel):
    url: str


class NavigateResponse(BaseModel):
    status: str
    url: str
