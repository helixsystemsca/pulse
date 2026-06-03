"""SMTP host validation and health-check staging."""

import socket
from unittest.mock import patch

from app.core.config import Settings
from app.core.smtp_connectivity import (
    _connect_sockaddr,
    effective_smtp_transport,
    run_smtp_health_check,
    validate_public_smtp_host,
)


def test_validate_public_smtp_host_rejects_localhost() -> None:
    assert "localhost" in (validate_public_smtp_host("localhost") or "")
    assert validate_public_smtp_host("127.0.0.1") is not None
    assert validate_public_smtp_host("mail.corp.local") is not None
    assert validate_public_smtp_host("192.168.1.10") is not None


def test_validate_public_smtp_host_accepts_public_name() -> None:
    assert validate_public_smtp_host("smtp.office365.com") is None


def test_health_check_stops_after_host_validation() -> None:
    settings = Settings(
        smtp_host="127.0.0.1",
        smtp_port=587,
        email_from_noreply="noreply@example.com",
    )
    report = run_smtp_health_check(settings)
    assert report.overall_ok is False
    assert report.stages[-1].name == "host_validation"
    assert report.stages[-1].ok is False


def test_connect_sockaddr_ipv6_does_not_use_create_connection_two_tuple() -> None:
    """IPv6 sockaddr is 4-tuple; create_connection(address) only accepts (host, port)."""
    sockaddr = ("2001:4860:4860::8888", 587, 0, 0)
    with patch("app.core.smtp_connectivity.socket.create_connection") as mock_cc:
        with patch("app.core.smtp_connectivity.socket.socket") as mock_socket_cls:
            mock_sock = mock_socket_cls.return_value
            _connect_sockaddr(socket.AF_INET6, socket.SOCK_STREAM, 0, sockaddr, timeout=5.0)
    mock_cc.assert_not_called()
    mock_sock.connect.assert_called_once_with(sockaddr)


def test_effective_smtp_transport_ssl_wins_over_tls() -> None:
    settings = Settings(smtp_use_ssl=True, smtp_use_tls=True)
    use_ssl, use_tls = effective_smtp_transport(settings)
    assert use_ssl is True
    assert use_tls is False


def test_health_check_includes_structured_results() -> None:
    settings = Settings(
        smtp_host="smtp.example.test",
        smtp_port=587,
        email_from_noreply="noreply@example.com",
    )
    with patch(
        "app.core.smtp_connectivity.resolve_smtp_host_dns",
        return_value=(True, "smtp.example.test -> 203.0.113.1", ["203.0.113.1"], 1.0),
    ):
        with patch(
            "app.core.smtp_connectivity.test_smtp_tcp",
            return_value=(False, "TCP connection failed: [Errno 101] Network is unreachable", 0.0),
        ):
            report = run_smtp_health_check(settings)
    assert "dns_resolution" in report.results
    assert report.results["dns_resolution"] == "success"
    assert report.results["tcp_connection"] == "failure"
    names = [s.name for s in report.stages]
    assert "dns_resolution" in names or "dns" in names
    assert "tcp_connection" in names or "tcp" in names
