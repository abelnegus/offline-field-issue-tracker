import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ReportCategory, ReportPriority, ReportStatus
from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    category: Mapped[ReportCategory] = mapped_column(
        Enum(ReportCategory),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    location: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    priority: Mapped[ReportPriority] = mapped_column(
        Enum(ReportPriority),
        nullable=False,
    )

    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus),
        nullable=False,
        default=ReportStatus.DRAFT,
    )

    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )