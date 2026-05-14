"""Typed permission key enum generated from the catalog (avoids string drift in Python code)."""

from __future__ import annotations

from enum import StrEnum

from app.core.rbac.registry import ALL_KNOWN_RBAC_KEYS


def _enum_members() -> dict[str, str]:
    # Enum member names must be valid identifiers; keys use dots.
    return {k.upper().replace(".", "_"): k for k in sorted(ALL_KNOWN_RBAC_KEYS)}


RbacPermissionKey = StrEnum("RbacPermissionKey", _enum_members())
