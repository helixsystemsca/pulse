"""Login lockout exponential backoff."""

from app.core.auth.lockout import lockout_duration_minutes
from app.core.config import Settings
from app.models.domain import User


def test_lockout_exponential_increases():
    settings = Settings(login_lockout_minutes=15, login_lockout_max_attempts=8, login_lockout_exponential=True)
    assert lockout_duration_minutes(settings, 8) == 15
    assert lockout_duration_minutes(settings, 16) == 30
    assert lockout_duration_minutes(settings, 40) == 120
