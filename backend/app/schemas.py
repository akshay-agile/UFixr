from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

UtilityType = Literal["electricity", "water"]
ReportStatus = Literal["pending", "acknowledged", "assigned", "in_progress", "resolved"]
ImpactLevel = Literal["just_me", "few_homes", "whole_street", "dangerous_emergency"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    phone: str = Field(min_length=8, max_length=20)
    password: str = Field(min_length=4, max_length=64)


class LoginRequest(BaseModel):
    phone: str
    password: str


class ReportCreateRequest(BaseModel):
    utility_type: UtilityType
    issue_type: str = Field(min_length=2, max_length=80)
    impact_level: ImpactLevel
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=500)
    severity: int | None = Field(default=None, ge=1, le=5)
    latitude: float
    longitude: float
    photo_url: str | None = None
    photo_urls: list[str] | None = None
    join_cluster_id: int | None = None
    preferred_technician_id: int | None = None


class ClusterStatusUpdateRequest(BaseModel):
    status: ReportStatus


class ClusterAssignmentRequest(BaseModel):
    technician_id: int
    eta_minutes: int = Field(ge=10, le=480)
    note: str = Field(default="", max_length=160)
