from app.core.enums import ReportStatus


VALID_STATUS_TRANSITIONS: dict[ReportStatus, set[ReportStatus]] = {
    ReportStatus.DRAFT: {
        ReportStatus.SUBMITTED,
    },
    ReportStatus.SUBMITTED: {
        ReportStatus.ASSIGNED,
        ReportStatus.REJECTED,
    },
    ReportStatus.ASSIGNED: {
        ReportStatus.IN_PROGRESS,
        ReportStatus.REJECTED,
    },
    ReportStatus.IN_PROGRESS: {
        ReportStatus.RESOLVED,
        ReportStatus.REJECTED,
    },
    ReportStatus.RESOLVED: set(),
    ReportStatus.REJECTED: set(),
}


def can_transition(
    current_status: ReportStatus,
    new_status: ReportStatus,
) -> bool:
    return new_status in VALID_STATUS_TRANSITIONS[current_status]