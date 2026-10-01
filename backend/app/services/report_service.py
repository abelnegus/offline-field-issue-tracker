from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import HistoryEventType, ReportStatus
from app.models.history import ReportHistory
from app.models.report import Report
from app.schemas.report import ReportCreate
from app.services.report_workflow import can_transition


def create_report(db: Session, data: ReportCreate) -> Report:
    existing_report = db.get(Report, str(data.id))

    if existing_report:
        if (
            existing_report.category != data.category
            or existing_report.description != data.description
            or existing_report.location != data.location
            or existing_report.priority != data.priority
            or existing_report.status != data.status
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A report with this ID already exists with different data.",
            )

        return existing_report

    if data.status not in {
        ReportStatus.DRAFT,
        ReportStatus.SUBMITTED,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A new report can only start as draft or submitted.",
        )

    report = Report(
        id=str(data.id),
        category=data.category,
        description=data.description,
        location=data.location,
        priority=data.priority,
        status=data.status,
        reported_at=data.reported_at,
    )

    db.add(report)

    history = ReportHistory(
        report_id=report.id,
        event_type=HistoryEventType.REPORT_CREATED,
        to_status=report.status,
        source="api",
        details="Report created on server.",
    )

    db.add(history)
    db.commit()
    db.refresh(report)

    return report


def get_reports(db: Session) -> list[Report]:
    statement = select(Report).order_by(Report.created_at.desc())
    return list(db.scalars(statement).all())


def get_report(db: Session, report_id: UUID) -> Report:
    report = db.get(Report, str(report_id))

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    return report


def update_report_status(
    db: Session,
    report_id: UUID,
    new_status: ReportStatus,
) -> Report:
    report = get_report(db, report_id)

    if not can_transition(report.status, new_status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid status transition: "
                f"{report.status.value} → {new_status.value}"
            ),
        )

    previous_status = report.status
    report.status = new_status
    report.version += 1

    history = ReportHistory(
        report_id=report.id,
        event_type=HistoryEventType.STATUS_CHANGED,
        from_status=previous_status,
        to_status=new_status,
        source="api",
        details=f"Status changed from {previous_status.value} to {new_status.value}.",
    )

    db.add(history)
    db.commit()
    db.refresh(report)

    return report


def get_report_history(
    db: Session,
    report_id: UUID,
) -> list[ReportHistory]:
    # First make sure the report exists.
    get_report(db, report_id)

    statement = (
        select(ReportHistory)
        .where(ReportHistory.report_id == str(report_id))
        .order_by(ReportHistory.timestamp.asc())
    )

    return list(db.scalars(statement).all())