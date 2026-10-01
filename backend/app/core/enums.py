from enum import Enum


class ReportCategory(str, Enum):
    WATER_POINT = "water_point"
    EQUIPMENT = "equipment"
    SERVICE_INTERRUPTION = "service_interruption"
    SAFETY = "safety"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class ReportPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class HistoryEventType(str, Enum):
    REPORT_CREATED = "report_created"
    STATUS_CHANGED = "status_changed"
    SYNC_STARTED = "sync_started"
    SYNC_SUCCEEDED = "sync_succeeded"
    SYNC_FAILED = "sync_failed"