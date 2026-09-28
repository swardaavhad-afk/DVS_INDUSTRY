from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DetectedObject(BaseModel):
    model_config = ConfigDict(extra="allow")

    track_id: int | str
    role: str | None = None


class IncidentRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: str = "1.0"
    incident_id: str
    camera_id: str
    location: str
    event_type: str
    detected_at: datetime
    confidence_tier: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    severity: str
    duration_s: float = Field(default=0.0, ge=0.0)
    description: str = ""
    detected_objects: list[DetectedObject] = Field(default_factory=list)
    zone_id: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    evidence: dict[str, Any] = Field(default_factory=dict)
    recommended_action: str = ""
    review_status: str = "pending"
