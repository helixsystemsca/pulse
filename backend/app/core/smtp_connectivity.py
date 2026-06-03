"""SMTP host validation, connectivity probes, and staged health checks."""

from __future__ import annotations

import ipaddress
import logging
import socket
import smtplib
import ssl
import time
import traceback
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

from app.core.config import Settings

_log = logging.getLogger(__name__)

_LOCAL_HOSTNAMES = frozenset({"localhost", "localhost.localdomain"})

_STAGE_DNS = "dns_resolution"
_STAGE_TCP = "tcp_connection"
_STAGE_SSL = "ssl_handshake"
_STAGE_TLS = "tls_starttls"
_STAGE_EHLO = "smtp_ehlo"
_STAGE_AUTH = "authentication"


class SmtpNetworkError(OSError):
    """TCP/DNS failure reaching the configured SMTP host (not auth or message errors)."""


@dataclass(frozen=True)
class SmtpHealthStage:
    name: str
    ok: bool
    detail: str
    duration_ms: Optional[float] = None


@dataclass
class SmtpHealthReport:
    host: str
    port: int
    use_tls: bool
    use_ssl: bool
    prefer_ipv4: bool
    timeout_seconds: float
    username: Optional[str]
    from_email: str
    stages: list[SmtpHealthStage] = field(default_factory=list)
    overall_ok: bool = False
    results: dict[str, str] = field(default_factory=dict)
    timings_ms: dict[str, float] = field(default_factory=dict)

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "use_tls": self.use_tls,
            "use_ssl": self.use_ssl,
            "prefer_ipv4": self.prefer_ipv4,
            "timeout_seconds": self.timeout_seconds,
            "username": self.username,
            "from_email": self.from_email,
            "overall_ok": self.overall_ok,
            "results": dict(self.results),
            "timings_ms": dict(self.timings_ms),
            "stages": [
                {
                    "name": s.name,
                    "ok": s.ok,
                    "detail": s.detail,
                    "duration_ms": s.duration_ms,
                }
                for s in self.stages
            ],
        }


def effective_smtp_transport(settings: Settings) -> tuple[bool, bool]:
    """
    Return (use_ssl, use_tls) for smtplib. Modes are mutually exclusive; SSL wins if both env flags are set.
    """
    use_ssl = bool(settings.smtp_use_ssl)
    use_tls = bool(settings.smtp_use_tls)
    if use_ssl and use_tls:
        _log.warning(
            "SMTP_USE_SSL and SMTP_USE_TLS are both true; using implicit SSL only (STARTTLS disabled)",
            extra={"host": settings.smtp_host.strip(), "port": settings.smtp_port},
        )
        use_tls = False
    if use_ssl and int(settings.smtp_port) == 587:
        _log.warning(
            "SMTP_USE_SSL=true with port 587 is unusual; Gmail implicit SSL typically uses port 465",
            extra={"host": settings.smtp_host.strip()},
        )
    if use_tls and int(settings.smtp_port) == 465:
        _log.warning(
            "SMTP_USE_TLS=true with port 465 is unusual; use SMTP_USE_SSL=true and SMTP_USE_TLS=false for port 465",
            extra={"host": settings.smtp_host.strip()},
        )
    return use_ssl, use_tls


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
    use_ssl, use_tls = effective_smtp_transport(settings)
    host = settings.smtp_host.strip()
    _log.info(
        "SMTP configuration",
        extra={
            "host": host,
            "port": settings.smtp_port,
            "use_tls": use_tls,
            "use_ssl": use_ssl,
            "prefer_ipv4": settings.smtp_prefer_ipv4,
            "timeout_seconds": smtp_connect_timeout(settings),
            "username": settings.smtp_username.strip() or None,
            "transport": "ssl" if use_ssl else ("starttls" if use_tls else "plain"),
        },
    )


def resolve_smtp_host_dns(host: str, port: int | None = None) -> tuple[bool, str, list[str], float]:
    """Resolve SMTP host; optional port for getaddrinfo. Returns (ok, detail, ips, duration_ms)."""
    t0 = time.perf_counter()
    try:
        if port is not None:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        else:
            infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        ips: list[str] = []
        seen: set[str] = set()
        for info in infos:
            addr = info[4][0]
            if addr not in seen:
                seen.add(addr)
                ips.append(addr)
        if not ips:
            return False, "DNS returned no addresses", [], elapsed_ms
        summary = ", ".join(ips[:8])
        if len(ips) > 8:
            summary += f" (+{len(ips) - 8} more)"
        return True, f"{host} -> {summary}", ips, elapsed_ms
    except OSError as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return False, f"DNS resolution failed: {exc}", [], elapsed_ms


def log_smtp_dns(host: str, port: int, *, prefer_ipv4: bool) -> tuple[bool, str, float]:
    _log.info("SMTP DNS lookup starting host=%s port=%s prefer_ipv4=%s", host, port, prefer_ipv4)
    ok, detail, ips, duration_ms = resolve_smtp_host_dns(host, port)
    if ok:
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            _log.info(
                "SMTP DNS getaddrinfo host=%s port=%s duration_ms=%.1f records=%s",
                host,
                port,
                duration_ms,
                infos,
            )
        except OSError as exc:
            _log.warning("SMTP DNS getaddrinfo log failed: %s", exc)
        _log.info("SMTP DNS resolved in %.1fms: %s", duration_ms, detail)
    else:
        _log.error(
            "SMTP DNS resolution failed host=%s port=%s duration_ms=%.1f: %s",
            host,
            port,
            duration_ms,
            detail,
        )
    return ok, detail, duration_ms


def _smtp_addrinfo_candidates(host: str, port: int, *, prefer_ipv4: bool) -> list[tuple]:
    """
    Return getaddrinfo rows: (family, socktype, proto, canonname, sockaddr).

    When prefer_ipv4 is True, only IPv4 candidates are used when available (Render egress).
    """
    results = list(socket.getaddrinfo(host, port, type=socket.SOCK_STREAM))
    _log.info("SMTP address candidates for %s:%s (count=%s): %s", host, port, len(results), results)
    if prefer_ipv4:
        v4_only = [row for row in results if row[0] == socket.AF_INET]
        if v4_only:
            _log.info("SMTP using IPv4-only candidates (%s of %s)", len(v4_only), len(results))
            return v4_only
        _log.warning("SMTP prefer_ipv4=true but no IPv4 addresses; falling back to all candidates")
    results.sort(key=lambda row: (row[0] != socket.AF_INET, row[0] == socket.AF_INET6))
    return results


def _connect_sockaddr(
    family: int,
    socktype: int,
    proto: int,
    sockaddr: tuple,
    *,
    timeout: float,
) -> socket.socket:
    """
    Connect using the full getaddrinfo sockaddr.

    Do not pass IPv6 sockaddrs (4-tuples) to socket.create_connection — it unpacks
    address as (host, port) and raises "too many values to unpack (expected 2, got 4)".
    """
    if family == socket.AF_INET and len(sockaddr) == 2:
        return socket.create_connection(sockaddr, timeout=timeout)
    sock = socket.socket(family, socktype, proto)
    try:
        if timeout is not None:
            sock.settimeout(timeout)
        sock.connect(sockaddr)
        return sock
    except Exception:
        sock.close()
        raise


def create_smtp_socket(
    host: str,
    port: int,
    *,
    timeout: float = 12.0,
    prefer_ipv4: bool = True,
) -> tuple[socket.socket, float]:
    """Open a TCP socket to SMTP. Returns (socket, connect_duration_ms)."""
    last_error: OSError | None = None
    candidates = _smtp_addrinfo_candidates(host, port, prefer_ipv4=prefer_ipv4)
    for family, socktype, proto, _canonname, sockaddr in candidates:
        t0 = time.perf_counter()
        try:
            sock = _connect_sockaddr(family, socktype, proto, sockaddr, timeout=timeout)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            _log.info(
                "SMTP TCP connected",
                extra={
                    "host": host,
                    "port": port,
                    "family": family,
                    "sockaddr": str(sockaddr),
                    "duration_ms": round(elapsed_ms, 1),
                },
            )
            return sock, elapsed_ms
        except OSError as exc:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            last_error = exc
            _log.info(
                "SMTP TCP attempt failed",
                extra={
                    "host": host,
                    "port": port,
                    "family": family,
                    "sockaddr": str(sockaddr),
                    "duration_ms": round(elapsed_ms, 1),
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
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
            sock, _ = create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=True)
            return sock
        return super()._get_socket(host, port, timeout)


class _SMTPSSL(smtplib.SMTP_SSL):
    def __init__(self, *args: Any, prefer_ipv4: bool = True, **kwargs: Any) -> None:
        self._prefer_ipv4 = prefer_ipv4
        super().__init__(*args, **kwargs)

    def _get_socket(self, host: str, port: int, timeout: float) -> socket.socket:
        if self._prefer_ipv4:
            sock, _ = create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=True)
            return self._context.wrap_socket(sock, server_hostname=host)
        return super()._get_socket(host, port, timeout)


def test_smtp_tcp(
    host: str,
    port: int,
    *,
    timeout: float = 12.0,
    prefer_ipv4: bool = True,
) -> tuple[bool, str, float]:
    try:
        sock, elapsed_ms = create_smtp_socket(host, port, timeout=timeout, prefer_ipv4=prefer_ipv4)
        sock.close()
        suffix = " (IPv4 preferred)" if prefer_ipv4 else ""
        return (
            True,
            f"TCP connection to {host}:{port} succeeded in {elapsed_ms:.0f}ms{suffix}",
            elapsed_ms,
        )
    except OSError as exc:
        return False, f"TCP connection to {host}:{port} failed: {exc}", 0.0


def _record_stage(
    report: SmtpHealthReport,
    key: str,
    stage_name: str,
    ok: bool,
    detail: str,
    duration_ms: float | None = None,
) -> None:
    report.results[key] = "success" if ok else "failure"
    if duration_ms is not None:
        report.timings_ms[key] = round(duration_ms, 1)
    report.stages.append(
        SmtpHealthStage(stage_name, ok, detail, duration_ms=duration_ms),
    )


def _init_probe_results(report: SmtpHealthReport) -> None:
    for key in (_STAGE_DNS, _STAGE_TCP, _STAGE_SSL, _STAGE_TLS, _STAGE_EHLO, _STAGE_AUTH):
        report.results[key] = "skipped"


@contextmanager
def smtp_session(settings: Settings, *, timeout: float | None = None) -> Iterator[smtplib.SMTP]:
    """Open SMTP, apply SSL or STARTTLS per settings. Caller sends mail then exits context."""
    connect_timeout = timeout if timeout is not None else smtp_connect_timeout(settings)
    prepare_smtp_connection(settings)
    host = settings.smtp_host.strip()
    port = settings.smtp_port
    prefer_ipv4 = settings.smtp_prefer_ipv4
    use_ssl, use_tls = effective_smtp_transport(settings)
    smtp: smtplib.SMTP | None = None
    try:
        t0 = time.perf_counter()
        if use_ssl:
            _log.info("SMTP opening SMTP_SSL session host=%s port=%s", host, port)
            smtp = _SMTPSSL(host, port, timeout=connect_timeout, prefer_ipv4=prefer_ipv4)
            _log.info(
                "SMTP_SSL session established in %.1fms (implicit TLS; no STARTTLS)",
                (time.perf_counter() - t0) * 1000.0,
            )
        else:
            _log.info("SMTP opening SMTP session host=%s port=%s", host, port)
            smtp = _SMTP(host, port, timeout=connect_timeout, prefer_ipv4=prefer_ipv4)
            _log.info("SMTP TCP+SMTP client ready in %.1fms", (time.perf_counter() - t0) * 1000.0)
            t_ehlo = time.perf_counter()
            smtp.ehlo()
            _log.info("SMTP EHLO completed in %.1fms", (time.perf_counter() - t_ehlo) * 1000.0)
            if use_tls:
                t_tls = time.perf_counter()
                smtp.starttls(context=ssl.create_default_context())
                _log.info("SMTP STARTTLS completed in %.1fms", (time.perf_counter() - t_tls) * 1000.0)
                smtp.ehlo()
                _log.info("SMTP post-STARTTLS EHLO completed")
        if settings.smtp_username.strip():
            t_auth = time.perf_counter()
            smtp.login(settings.smtp_username.strip(), settings.smtp_password)
            _log.info("SMTP authentication completed in %.1fms", (time.perf_counter() - t_auth) * 1000.0)
        yield smtp
    except Exception:
        _log.exception(
            "SMTP session failed host=%s port=%s ssl=%s tls=%s prefer_ipv4=%s",
            host,
            port,
            use_ssl,
            use_tls,
            prefer_ipv4,
        )
        raise
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                try:
                    smtp.close()
                except Exception:
                    pass


def test_smtp_protocol_and_auth(settings: Settings, *, timeout: float | None = None) -> list[SmtpHealthStage]:
    """
    EHLO / TLS / SSL and authentication probes with per-stage timing.
    Used by run_smtp_health_check after TCP succeeds.
    """
    connect_timeout = timeout if timeout is not None else smtp_connect_timeout(settings)
    host = settings.smtp_host.strip()
    port = settings.smtp_port
    prefer_ipv4 = settings.smtp_prefer_ipv4
    use_ssl, use_tls = effective_smtp_transport(settings)
    stages: list[SmtpHealthStage] = []

    if use_ssl:
        stages.append(SmtpHealthStage(_STAGE_TLS, True, "skipped (using implicit SSL)", duration_ms=0.0))
        t0 = time.perf_counter()
        try:
            smtp = _SMTPSSL(host, port, timeout=connect_timeout, prefer_ipv4=prefer_ipv4)
            elapsed = (time.perf_counter() - t0) * 1000.0
            stages.append(
                SmtpHealthStage(
                    _STAGE_SSL,
                    True,
                    f"SMTP_SSL (implicit TLS) to {host}:{port} in {elapsed:.0f}ms",
                    duration_ms=elapsed,
                ),
            )
            stages.append(
                SmtpHealthStage(
                    _STAGE_EHLO,
                    True,
                    "EHLO completed during SMTP_SSL connect",
                    duration_ms=elapsed,
                ),
            )
            try:
                smtp.quit()
            except Exception:
                smtp.close()
        except OSError as exc:
            elapsed = (time.perf_counter() - t0) * 1000.0
            stages.append(
                SmtpHealthStage(
                    _STAGE_SSL,
                    False,
                    f"SMTP_SSL failed: {exc}",
                    duration_ms=elapsed,
                ),
            )
            stages.append(SmtpHealthStage(_STAGE_EHLO, False, "skipped (SSL failed)", duration_ms=0.0))
            return stages
    else:
        stages.append(SmtpHealthStage(_STAGE_SSL, True, "skipped (not using SMTP_SSL)", duration_ms=0.0))
        smtp: smtplib.SMTP | None = None
        try:
            t0 = time.perf_counter()
            smtp = _SMTP(host, port, timeout=connect_timeout, prefer_ipv4=prefer_ipv4)
            tcp_ms = (time.perf_counter() - t0) * 1000.0
            t_ehlo = time.perf_counter()
            smtp.ehlo()
            ehlo_ms = (time.perf_counter() - t_ehlo) * 1000.0
            stages.append(
                SmtpHealthStage(
                    _STAGE_EHLO,
                    True,
                    f"EHLO to {host}:{port} in {ehlo_ms:.0f}ms",
                    duration_ms=ehlo_ms,
                ),
            )
            if use_tls:
                t_tls = time.perf_counter()
                smtp.starttls(context=ssl.create_default_context())
                tls_ms = (time.perf_counter() - t_tls) * 1000.0
                smtp.ehlo()
                stages.append(
                    SmtpHealthStage(
                        _STAGE_TLS,
                        True,
                        f"STARTTLS negotiated in {tls_ms:.0f}ms",
                        duration_ms=tls_ms,
                    ),
                )
            else:
                stages.append(
                    SmtpHealthStage(_STAGE_TLS, True, "skipped (plain SMTP)", duration_ms=0.0),
                )
            _log.info("SMTP plain session opened in %.1fms (tcp+client %.1fms)", tcp_ms + ehlo_ms, tcp_ms)
        except OSError as exc:
            stages.append(SmtpHealthStage(_STAGE_EHLO, False, f"SMTP/EHLO failed: {exc}", duration_ms=0.0))
            if use_tls:
                stages.append(SmtpHealthStage(_STAGE_TLS, False, "skipped (EHLO failed)", duration_ms=0.0))
            if smtp is not None:
                try:
                    smtp.close()
                except Exception:
                    pass
            return stages
        finally:
            if smtp is not None:
                try:
                    smtp.quit()
                except Exception:
                    try:
                        smtp.close()
                    except Exception:
                        pass

    auth_ok, auth_detail = test_smtp_authentication(settings, timeout=connect_timeout)
    stages.append(SmtpHealthStage(_STAGE_AUTH, auth_ok, auth_detail, duration_ms=None))
    return stages


def test_smtp_authentication(settings: Settings, *, timeout: float | None = None) -> tuple[bool, str]:
    username = settings.smtp_username.strip()
    connect_timeout = timeout if timeout is not None else smtp_connect_timeout(settings)
    t0 = time.perf_counter()
    try:
        with smtp_session(settings, timeout=connect_timeout):
            elapsed = (time.perf_counter() - t0) * 1000.0
            if username:
                return True, f"SMTP authentication succeeded in {elapsed:.0f}ms"
            return True, f"SMTP session opened in {elapsed:.0f}ms (no SMTP_USERNAME; login skipped)"
    except smtplib.SMTPAuthenticationError as exc:
        _log.exception("SMTP authentication rejected")
        return False, f"SMTP authentication failed: {exc}"
    except SmtpNetworkError as exc:
        _log.error("SMTP authentication network failure: %s\n%s", exc, traceback.format_exc())
        return False, str(exc)
    except OSError as exc:
        _log.exception("SMTP authentication connection failed")
        return False, smtp_network_error_message(exc)
    except smtplib.SMTPException as exc:
        _log.exception("SMTP authentication protocol error")
        return False, f"SMTP protocol error: {exc}"


def run_smtp_health_check(settings: Settings) -> SmtpHealthReport:
    host = settings.smtp_host.strip()
    use_ssl, use_tls = effective_smtp_transport(settings)
    report = SmtpHealthReport(
        host=host,
        port=settings.smtp_port,
        use_tls=use_tls,
        use_ssl=use_ssl,
        prefer_ipv4=settings.smtp_prefer_ipv4,
        timeout_seconds=smtp_connect_timeout(settings),
        username=settings.smtp_username.strip() or None,
        from_email=settings.email_from_noreply.strip(),
    )
    _init_probe_results(report)

    if not host:
        _record_stage(report, "configuration", "configuration", False, "SMTP host not configured")
        return report
    if not report.from_email:
        _record_stage(report, "configuration", "configuration", False, "SMTP sender email not configured")
        return report

    host_err = validate_public_smtp_host(host)
    if host_err:
        _record_stage(report, "host_validation", "host_validation", False, host_err)
        return report
    _record_stage(report, "host_validation", "host_validation", True, "SMTP host is a public hostname")

    dns_ok, dns_detail, dns_ms = log_smtp_dns(host, settings.smtp_port, prefer_ipv4=settings.smtp_prefer_ipv4)
    _record_stage(report, _STAGE_DNS, _STAGE_DNS, dns_ok, dns_detail, duration_ms=dns_ms)
    if not dns_ok:
        return report

    tcp_ok, tcp_detail, tcp_ms = test_smtp_tcp(
        host,
        settings.smtp_port,
        timeout=report.timeout_seconds,
        prefer_ipv4=settings.smtp_prefer_ipv4,
    )
    _record_stage(report, _STAGE_TCP, _STAGE_TCP, tcp_ok, tcp_detail, duration_ms=tcp_ms)
    if not tcp_ok:
        return report

    for stage in test_smtp_protocol_and_auth(settings, timeout=report.timeout_seconds):
        key = stage.name
        if key in report.results:
            report.results[key] = "success" if stage.ok else "failure"
            if stage.duration_ms is not None:
                report.timings_ms[key] = stage.duration_ms
        report.stages.append(stage)

    auth_stage = next((s for s in report.stages if s.name == _STAGE_AUTH), None)
    report.overall_ok = bool(auth_stage and auth_stage.ok)
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

    dns_ok, dns_detail, _ = log_smtp_dns(host, settings.smtp_port, prefer_ipv4=settings.smtp_prefer_ipv4)
    if not dns_ok:
        raise SmtpNetworkError(dns_detail)

    use_ssl, use_tls = effective_smtp_transport(settings)
    _log.info(
        "Attempting SMTP connection",
        extra={
            "host": host,
            "port": settings.smtp_port,
            "use_ssl": use_ssl,
            "use_tls": use_tls,
            "prefer_ipv4": settings.smtp_prefer_ipv4,
            "timeout_seconds": smtp_connect_timeout(settings),
        },
    )


def smtp_connect_timeout(settings: Settings) -> float:
    """TCP + TLS + login budget for smtplib (seconds)."""
    raw = getattr(settings, "smtp_timeout_seconds", 25.0)
    try:
        t = float(raw)
    except (TypeError, ValueError):
        t = 25.0
    return max(5.0, min(t, 120.0))


def smtp_network_error_message(exc: BaseException) -> str:
    base = f"SMTP network connection failed: {exc}"
    lowered = str(exc).lower()
    if "timed out" in lowered or isinstance(exc, TimeoutError):
        return (
            f"{base} Timed out before the mail server responded — check which stage failed in "
            "GET /api/system/smtp-health or GET /api/v1/company/profile/smtp-health (dns_resolution, "
            "tcp_connection, ssl_handshake, tls_starttls). On Render, try Gmail port 465 with "
            "SMTP_USE_SSL=true, SMTP_USE_TLS=false, SMTP_PREFER_IPV4=false, SMTP_TIMEOUT_SECONDS=45, "
            "and a Google App Password. If TCP still times out, outbound SMTP may be blocked; use "
            "SendGrid, Resend, or Mailgun HTTP APIs instead."
        )
    if "network is unreachable" in lowered or "errno 101" in lowered:
        return (
            f"{base} Set SMTP_PREFER_IPV4=true on the API service and use a public SMTP hostname "
            "(not localhost or a .local address)."
        )
    return base


def is_smtp_network_failure(exc: BaseException) -> bool:
    return isinstance(exc, (SmtpNetworkError, OSError))
