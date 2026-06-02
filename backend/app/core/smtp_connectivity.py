"""SMTP host validation, connectivity probes, and staged health checks."""

from __future__ import annotations

import ipaddress
import logging
import socket
import smtplib
import ssl
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

from app.core.config import Settings

_log = logging.getLogger(__name__)

_LOCAL_HOSTNAMES = frozenset({"localhost", "localhost.localdomain"})


class SmtpNetworkError(OSError):
    """TCP/DNS failure reaching the configured SMTP host (not auth or message errors)."""


@dataclass(frozen=True)
class SmtpHealthStage:
    name: str
    ok: bool
    detail: str


@dataclass
class SmtpHealthReport:
    host: str
    port: int
    use_tls: bool
    use_ssl: bool
    username: Optional[str]
    from_email: str
    stages: list[SmtpHealthStage] = field(default_factory=list)
    overall_ok: bool = False

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "use_tls": self.use_tls,
            "use_ssl": self.use_ssl,
            "username": self.username,
            "from_email": self.from_email,
            "overall_ok": self.overall_ok,
            "stages": [{"name": s.name, "ok": s.ok, "detail": s.detail} for s in self.stages],
        }


def validate_public_smtp_host(host: str) -> str | None:
    """
    Reject hosts that cannot work from a cloud runtime (Render, etc.).
    Returns a user-facing error string, or None if the hostname looks acceptable.
    """
    raw = (host or "").strip()
    if not raw:
        return "SMTP host not configured"
    lowered = raw.lower().rstrip(".")
    if lowered in _LOCAL_HOSTNAMES:
        return (
            f"SMTP host {raw!r} is not reachable from a cloud server; "
            "use your mail provider's public SMTP hostname (e.g. smtp.office365.com)."
        )
    if lowered.endswith(".local"):
        return (
            f"SMTP host {raw!r} is a private .local name and is not reachable from a cloud server; "
            "use a public SMTP hostname."
        )
    try:
        ip = ipaddress.ip_address(raw)
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
            return (
                f"SMTP host {raw} is a non-routable address and is not reachable from a cloud server; "
                "use your provider's public SMTP hostname."
            )
    except ValueError:
        pass
    return None


def log_smtp_configuration(settings: Settings) -> None:
    host = settings.smtp_host.strip()
    _log.info(
        "SMTP configuration",
        extra={
            "host": host,
            "port": settings.smtp_port,
            "tls": settings.smtp_use_tls,
            "ssl": settings.smtp_use_ssl,
            "prefer_ipv4": settings.smtp_prefer_ipv4,
            "username": settings.smtp_username.strip() or None,
        },
    )


def resolve_smtp_host_dns(host: str) -> tuple[bool, str, list[str]]:
    """Resolve SMTP host to IPv4/IPv6 addresses."""
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        ips: list[str] = []
        seen: set[str] = set()
        for info in infos:
            addr = info[4][0]
            if addr not in seen:
                seen.add(addr)
                ips.append(addr)
        if not ips:
            return False, "DNS returned no addresses", []
        summary = ", ".join(ips[:8])
        if len(ips) > 8:
            summary += f" (+{len(ips) - 8} more)"
        return True, f"{host} -> {summary}", ips
    except OSError as exc:
        return False, f"DNS resolution failed: {exc}", []


def log_smtp_dns(host: str) -> tuple[bool, str]:
    ok, detail, _ = resolve_smtp_host_dns(host)
    if ok:
        _log.info("SMTP DNS resolved: %s", detail)
    else:
        _log.error("SMTP DNS resolution failed for host=%s: %s", host, detail)
    return ok, detail


def _addrinfo_sorted(host: str, port: int, *, prefer_ipv4: bool) -> list[tuple]:
    infos = list(socket.getaddrinfo(host, port, type=socket.SOCK_STREAM))
    if prefer_ipv4:
        infos.sort(key=lambda i: (i[0] != socket.AF_INET, i[0] == socket.AF_INET6))
    return infos


def create_smtp_socket(
    host: str,
    port: int,
    *,
    timeout: float = 12.0,
    prefer_ipv4: bool = True,
) -> socket.socket:
    """Open a TCP socket to SMTP, trying IPv4 before IPv6 when prefer_ipv4 is set."""
    last_error: OSError | None = None
    for _family, _socktype, _proto, _canon, sockaddr in _addrinfo_sorted(host, port, prefer_ipv4=prefer_ipv4):
        try:
            return socket.create_connection(sockaddr, timeout=timeout)
        except OSError as exc:
            last_error = exc
            _log.info(
                "SMTP TCP attempt failed",
                extra={"host": host, "port": port, "sockaddr": str(sockaddr), "error": str(exc)},
            )
    if last_error is not None:
        raise last_error
    raise OSError(f"No address found for {host}:{port}")


class _SMTP(smtplib.SMTP):
    """SMTP client that prefers IPv4 (Render and similar hosts often lack IPv6 egress)."""

    def __init__(self, *args: Any, prefer_ipv4: bool = True, **kwargs: Any) -> None:
        self._prefer_ipv4 = prefer_ipv4
        super().__init__(*args, **kwargs)

    def _get_socket(self, host: str, port: int, timeout: float) -> socket.socket:
        if self._prefer_ipv4:
            return create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=True)
        return super()._get_socket(host, port, timeout)


class _SMTPSSL(smtplib.SMTP_SSL):
    def __init__(self, *args: Any, prefer_ipv4: bool = True, **kwargs: Any) -> None:
        self._prefer_ipv4 = prefer_ipv4
        super().__init__(*args, **kwargs)

    def _get_socket(self, host: str, port: int, timeout: float) -> socket.socket:
        if self._prefer_ipv4:
            sock = create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=True)
            return self._context.wrap_socket(sock, server_hostname=host)
        return super()._get_socket(host, port, timeout)


def test_smtp_tcp(
    host: str,
    port: int,
    *,
    timeout: float = 12.0,
    prefer_ipv4: bool = True,
) -> tuple[bool, str]:
    try:
        sock = create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=prefer_ipv4)
        sock.close()
        suffix = " (IPv4 preferred)" if prefer_ipv4 else ""
        return True, f"TCP connection to {host}:{port} succeeded{suffix}"
    except OSError as exc:
        return False, f"TCP connection to {host}:{port} failed: {exc}"


@contextmanager
def smtp_session(settings: Settings, *, timeout: float = 12.0) -> Iterator[smtplib.SMTP]:
    """Open SMTP, apply TLS/login per settings. Caller sends mail then exits context."""
    prepare_smtp_connection(settings)
    host = settings.smtp_host.strip()
    port = settings.smtp_port
    prefer_ipv4 = settings.smtp_prefer_ipv4
    smtp: smtplib.SMTP | None = None
    try:
        if settings.smtp_use_ssl:
            smtp = _SMTPSSL(host, port, timeout=timeout, prefer_ipv4=prefer_ipv4)
        else:
            # timeout is only valid on the SMTP constructor, not connect() (stdlib smtplib).
            smtp = _SMTP(host, port, timeout=timeout, prefer_ipv4=prefer_ipv4)
            smtp.ehlo()
            if settings.smtp_use_tls:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
        if settings.smtp_username.strip():
            smtp.login(settings.smtp_username.strip(), settings.smtp_password)
        yield smtp
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                try:
                    smtp.close()
                except Exception:
                    pass


def test_smtp_authentication(settings: Settings, *, timeout: float = 12.0) -> tuple[bool, str]:
    username = settings.smtp_username.strip()
    try:
        with smtp_session(settings, timeout=timeout):
            if username:
                return True, "SMTP authentication succeeded"
            return True, "SMTP session opened (no SMTP_USERNAME configured; login skipped)"
    except smtplib.SMTPAuthenticationError as exc:
        return False, f"SMTP authentication failed: {exc}"
    except SmtpNetworkError as exc:
        return False, str(exc)
    except OSError as exc:
        return False, f"SMTP connection failed: {exc}"
    except smtplib.SMTPException as exc:
        return False, f"SMTP protocol error: {exc}"


def run_smtp_health_check(settings: Settings) -> SmtpHealthReport:
    host = settings.smtp_host.strip()
    report = SmtpHealthReport(
        host=host,
        port=settings.smtp_port,
        use_tls=settings.smtp_use_tls,
        use_ssl=settings.smtp_use_ssl,
        username=settings.smtp_username.strip() or None,
        from_email=settings.email_from_noreply.strip(),
    )

    if not host:
        report.stages.append(SmtpHealthStage("configuration", False, "SMTP host not configured"))
        return report
    if not report.from_email:
        report.stages.append(SmtpHealthStage("configuration", False, "SMTP sender email not configured"))
        return report

    host_err = validate_public_smtp_host(host)
    if host_err:
        report.stages.append(SmtpHealthStage("host_validation", False, host_err))
        return report
    report.stages.append(SmtpHealthStage("host_validation", True, "SMTP host is a public hostname"))

    dns_ok, dns_detail, _ = resolve_smtp_host_dns(host)
    report.stages.append(
        SmtpHealthStage("dns", dns_ok, dns_detail),
    )
    if not dns_ok:
        return report

    tcp_ok, tcp_detail = test_smtp_tcp(host, settings.smtp_port, prefer_ipv4=settings.smtp_prefer_ipv4)
    report.stages.append(SmtpHealthStage("tcp", tcp_ok, tcp_detail))
    if not tcp_ok:
        return report

    auth_ok, auth_detail = test_smtp_authentication(settings)
    report.stages.append(SmtpHealthStage("authentication", auth_ok, auth_detail))
    report.overall_ok = auth_ok
    return report


def prepare_smtp_connection(settings: Settings) -> None:
    """
    Log SMTP settings, validate host, resolve DNS, and log before smtplib connects.
    Raises SmtpNetworkError when the host cannot be reached at the network layer.
    """
    host = settings.smtp_host.strip()
    log_smtp_configuration(settings)

    host_err = validate_public_smtp_host(host)
    if host_err:
        raise SmtpNetworkError(host_err)

    dns_ok, dns_detail = log_smtp_dns(host)
    if not dns_ok:
        raise SmtpNetworkError(dns_detail)

    _log.info(
        "Attempting SMTP connection",
        extra={"host": host, "port": settings.smtp_port},
    )


def smtp_network_error_message(exc: BaseException) -> str:
    return f"SMTP network connection failed: {exc}"


def is_smtp_network_failure(exc: BaseException) -> bool:
    return isinstance(exc, (SmtpNetworkError, OSError))
