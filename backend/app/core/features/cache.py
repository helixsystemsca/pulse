"""In-process TTL cache for tenant enabled_features (invalidated on admin toggle)."""

import time
from threading import Lock
from typing import FrozenSet

_LOCK = Lock()
_STORE: dict[str, tuple[float, FrozenSet[str]]] = {}
_TTL_SEC = 30.0


def get_cached(company_id: str) -> FrozenSet[str] | None:
    now = time.monotonic()
    with _LOCK:
        row = _STORE.get(company_id)
        if row is None:
            return None
        ts, feats = row
        if now - ts > _TTL_SEC:
            del _STORE[company_id]
            return None
        return feats


def set_cached(company_id: str, features: FrozenSet[str]) -> None:
    with _LOCK:
        _STORE[company_id] = (time.monotonic(), features)


def invalidate(company_id: str) -> None:
    with _LOCK:
        _STORE.pop(company_id, None)
