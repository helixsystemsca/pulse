"""Operational notification email parsing and SMTP validation helpers."""

from app.core.config import Settings
from app.core.email_smtp import outbound_smtp_configuration_error
from app.core.operational_notifications import _parse_email_list


def test_parse_email_list_comma_trailing() -> None:
    assert _parse_email_list("user@example.com,") == ["user@example.com"]
    assert _parse_email_list("user@example.com, ") == ["user@example.com"]


def test_parse_email_list_filters_empty_and_invalid() -> None:
    assert _parse_email_list("a@b.com, not-an-email, c@d.org") == ["a@b.com", "c@d.org"]
    assert _parse_email_list("") == []


def test_outbound_smtp_configuration_error() -> None:
    assert outbound_smtp_configuration_error(Settings(smtp_host="", email_from_noreply="a@b.com")) == (
        "SMTP host not configured"
    )
    assert outbound_smtp_configuration_error(Settings(smtp_host="smtp.example.com", email_from_noreply="")) == (
        "SMTP sender email not configured"
    )
    assert (
        outbound_smtp_configuration_error(
            Settings(smtp_host="smtp.example.com", email_from_noreply="noreply@helixsystems.ca")
        )
        is None
    )
