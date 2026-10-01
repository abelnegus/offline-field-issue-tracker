import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import HistoryEventType, ReportStatus
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReportHistory(Base):
    __tablename__ = "report_history"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    report_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("reports.id"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[HistoryEventType] = mapped_column(
        Enum(HistoryEventType),
        nullable=False,
    )

    from_status: Mapped[ReportStatus | None] = mapped_column(
        Enum(ReportStatus),
        nullable=True,
    )

    to_status: Mapped[ReportStatus | None] = mapped_column(
        Enum(ReportStatus),
        nullable=True,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )