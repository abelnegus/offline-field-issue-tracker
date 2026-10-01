import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.enums import ReportCategory, ReportPriority, ReportStatus
from app.database import Base
from app.models.history import ReportHistory
from app.models.report import Report
from app.schemas.report import ReportCreate
from app.services.report_service import (
    create_report,
    get_report,
    get_report_history,
    get_reports,
    update_report_status,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
    )

    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def make_report_data(
    report_id=None,
    status=ReportStatus.DRAFT,
):
    return ReportCreate(
        id=report_id or uuid.uuid4(),
        category=ReportCategory.WATER_POINT,
        description="Broken water pump",
        location="Village A",
        priority=ReportPriority.HIGH,
        status=status,
        reported_at=datetime.now(timezone.utc),
    )


def test_create_report(db):
    data = make_report_data()

    report = create_report(db, data)

    assert report.id == str(data.id)
    assert report.category == ReportCategory.WATER_POINT
    assert report.description == "Broken water pump"
    assert report.status == ReportStatus.DRAFT


def test_create_report_creates_history(db):
    data = make_report_data()

    report = create_report(db, data)

    history = get_report_history(db, uuid.UUID(report.id))

    assert len(history) == 1
    assert history[0].event_type.value == "report_created"
    assert history[0].to_status == ReportStatus.DRAFT


def test_duplicate_report_is_idempotent(db):
    report_id = uuid.uuid4()

    first = create_report(
        db,
        make_report_data(report_id=report_id),
    )

    second = create_report(
        db,
        make_report_data(report_id=report_id),
    )

    assert first.id == second.id

    reports = get_reports(db)

    assert len(reports) == 1


def test_duplicate_report_with_different_data_is_rejected(db):
    report_id = uuid.uuid4()

    create_report(
        db,
        make_report_data(report_id=report_id),
    )

    conflicting_data = ReportCreate(
        id=report_id,
        category=ReportCategory.SAFETY,
        description="Different report",
        location="Village B",
        priority=ReportPriority.CRITICAL,
        status=ReportStatus.DRAFT,
        reported_at=datetime.now(timezone.utc),
    )

    with pytest.raises(HTTPException) as exc_info:
        create_report(db, conflicting_data)

    assert exc_info.value.status_code == 409


def test_get_report(db):
    data = make_report_data()

    created = create_report(db, data)
    retrieved = get_report(db, uuid.UUID(created.id))

    assert retrieved.id == created.id


def test_status_update_creates_history(db):
    data = make_report_data()

    report = create_report(db, data)

    updated = update_report_status(
        db,
        uuid.UUID(report.id),
        ReportStatus.SUBMITTED,
    )

    assert updated.status == ReportStatus.SUBMITTED
    assert updated.version == 2

    history = get_report_history(db, uuid.UUID(report.id))

    assert len(history) == 2

    status_event = history[1]

    assert status_event.from_status == ReportStatus.DRAFT
    assert status_event.to_status == ReportStatus.SUBMITTED


def test_invalid_status_update_is_rejected(db):
    data = make_report_data()

    report = create_report(db, data)

    with pytest.raises(HTTPException) as exc_info:
        update_report_status(
            db,
            uuid.UUID(report.id),
            ReportStatus.RESOLVED,
        )

    assert exc_info.value.status_code == 409

    refreshed = get_report(db, uuid.UUID(report.id))

    assert refreshed.status == ReportStatus.DRAFT
    assert refreshed.version == 1


def test_get_reports_returns_all_reports(db):
    create_report(db, make_report_data())
    create_report(db, make_report_data())
    create_report(db, make_report_data())

    reports = get_reports(db)

    assert len(reports) == 3