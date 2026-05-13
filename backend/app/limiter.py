"""Shared SlowAPI limiter instance (avoid circular imports with `main`)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Default cap per IP; auth routes use tighter per-route limits (see auth_routes).
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
