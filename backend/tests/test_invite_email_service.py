"""Invite email helper messages."""

from app.services.invite_email_service import invite_failure_message


def test_invite_failure_message_appends_error() -> None:
    assert invite_failure_message("Worker saved", "SMTP host not configured") == (
        "Worker saved: SMTP host not configured"
    )
    assert invite_failure_message("Worker saved", None) == "Worker saved"
