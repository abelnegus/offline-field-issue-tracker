from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import ReportCategory, ReportPriority, ReportStatus


class ReportCreate(BaseModel):
    id: UUID
    category: ReportCategory
    description: str = Field(min_length=1, max_length=5000)
    location: str = Field(min_length=1, max_length=255)
    priority: ReportPriority
    status: ReportStatus = ReportStatus.DRAFT
    reported_at: datetime


class ReportStatusUpdate(BaseModel):
    status: ReportStatus


class ReportResponse(BaseModel):
    id: str
    category: ReportCategory
    description: str
    location: str
    priority: ReportPriority
    status: ReportStatus
    reported_at: datetime
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = {"from_attributes": True}