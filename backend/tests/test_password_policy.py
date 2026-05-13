"""Password policy validation (no database)."""

from __future__ import annotations

import pytest

from app.core.auth.password_policy import validate_new_password
from app.core.config import get_settings


@pytest.fixture
def strong_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PASSWORD_MIN_LENGTH", "12")
    monkeypatch.setenv("PASSWORD_REQUIRE_CHARACTER_CLASSES", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_validate_new_password_accepts_strong_password(strong_policy: None) -> None:
    validate_new_password("Correct-Horse-99!", get_settings())


def test_validate_new_password_rejects_short(strong_policy: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PASSWORD_MIN_LENGTH", "14")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="at least"):
            validate_new_password("Only12chars1!", get_settings())
    finally:
        get_settings.cache_clear()


def test_validate_new_password_rejects_weak_classes(strong_policy: None) -> None:
    with pytest.raises(ValueError, match="three of"):
        validate_new_password("onlylowercaseletters", get_settings())


def test_validate_new_password_length_only_when_classes_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PASSWORD_REQUIRE_CHARACTER_CLASSES", "false")
    monkeypatch.setenv("PASSWORD_MIN_LENGTH", "12")
    get_settings.cache_clear()
    try:
        validate_new_password("abcdefghijkl", get_settings())
    finally:
        get_settings.cache_clear()
