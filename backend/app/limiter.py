"""Shared SlowAPI limiter instance (avoid circular imports with `main`)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Default cap per IP; stricter limits on /auth/* are applied per-route.
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
