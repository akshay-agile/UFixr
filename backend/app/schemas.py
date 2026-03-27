from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UtilityType = Literal["electricity", "water"]
ReportStatus = Literal["pending", "acknowledged", "in_progress", "resolved"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=4, max_length=64)


class LoginRequest(BaseModel):
    phone: str
    password: str


class ReportCreateRequest(BaseModel):
    utility_type: UtilityType
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=500)
    severity: int = Field(ge=1, le=5)
    latitude: float
    longitude: float
    photo_url: str | None = None


class ClusterStatusUpdateRequest(BaseModel):
    status: ReportStatus
