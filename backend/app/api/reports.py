from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportStatusUpdate,
)
from app.services.report_service import (
    create_report,
    get_report,
    get_report_history,
    get_reports,
    update_report_status,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report_endpoint(
    data: ReportCreate,
    db: Session = Depends(get_db),
):
    return create_report(db, data)


@router.get("", response_model=list[ReportResponse])
def list_reports(
    db: Session = Depends(get_db),
):
    return get_reports(db)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report_endpoint(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    return get_report(db, report_id)


@router.patch("/{report_id}/status", response_model=ReportResponse)
def update_status_endpoint(
    report_id: UUID,
    data: ReportStatusUpdate,
    db: Session = Depends(get_db),
):
    return update_report_status(
        db,
        report_id,
        data.status,
    )


@router.get("/{report_id}/history")
def get_history_endpoint(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    return get_report_history(db, report_id)