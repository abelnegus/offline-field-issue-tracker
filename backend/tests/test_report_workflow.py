from app.core.enums import ReportStatus
from app.services.report_workflow import can_transition


def test_valid_status_transitions():
    assert can_transition(
        ReportStatus.DRAFT,
        ReportStatus.SUBMITTED,
    )

    assert can_transition(
        ReportStatus.SUBMITTED,
        ReportStatus.ASSIGNED,
    )

    assert can_transition(
        ReportStatus.SUBMITTED,
        ReportStatus.REJECTED,
    )

    assert can_transition(
        ReportStatus.ASSIGNED,
        ReportStatus.IN_PROGRESS,
    )

    assert can_transition(
        ReportStatus.IN_PROGRESS,
        ReportStatus.RESOLVED,
    )


def test_invalid_status_transitions():
    assert not can_transition(
        ReportStatus.DRAFT,
        ReportStatus.ASSIGNED,
    )

    assert not can_transition(
        ReportStatus.DRAFT,
        ReportStatus.RESOLVED,
    )

    assert not can_transition(
        ReportStatus.RESOLVED,
        ReportStatus.IN_PROGRESS,
    )

    assert not can_transition(
        ReportStatus.REJECTED,
        ReportStatus.SUBMITTED,
    )