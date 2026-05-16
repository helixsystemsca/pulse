#!/usr/bin/env python3
"""Report matrix slot resolution before/after baseline migration (run from backend/)."""

from __future__ import annotations

import asyncio
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.department_matrix_baselines import DEPARTMENT_BASELINE_SLOTS
from app.core.matrix_slot_policy import resolve_matrix_slot_detailed
from app.core.permission_feature_matrix import permission_matrix_department_for_user
from app.db.session import async_session_maker
from app.models.domain import User
from app.models.pulse_models import PulseWorkerHR


async def main() -> None:
    async with async_session_maker() as db:
        users = list((await db.execute(select(User).where(User.is_active.is_(True)))).scalars().all())
        hr_rows = list((await db.execute(select(PulseWorkerHR))).scalars().all())
    hr_map = {h.user_id: h for h in hr_rows}

    by_dept_slot: dict[str, Counter[str]] = defaultdict(Counter)
    by_source: Counter[str] = Counter()
    team_member_fallback = 0
    unresolved = 0
    migratable = 0

    for u in users:
        h = hr_map.get(u.id)
        dept = permission_matrix_department_for_user(u, h)
        detail = resolve_matrix_slot_detailed(u, h)
        by_dept_slot[dept][detail.slot] += 1
        by_source[detail.source] += 1
        if detail.source in ("fallback_default",) and detail.slot == "team_member":
            team_member_fallback += 1
        if detail.slot == "unresolved":
            unresolved += 1
        explicit = getattr(h, "matrix_slot", None) if h else None
        if h and not (explicit and str(explicit).strip()):
            baseline = DEPARTMENT_BASELINE_SLOTS.get(dept)
            if baseline and detail.source == "department_baseline":
                migratable += 1

    print("=== Matrix slot migration report ===\n")
    print("Department baseline map:")
    for d, s in sorted(DEPARTMENT_BASELINE_SLOTS.items()):
        print(f"  {d:16} -> {s}")
    print("\nResolved slot by department:")
    for dept in sorted(by_dept_slot):
        print(f"  {dept}:")
        for slot, n in by_dept_slot[dept].most_common():
            print(f"    {slot:20} {n}")
    print("\nBy source:")
    for src, n in by_source.most_common():
        print(f"  {src:24} {n}")
    print(f"\nLegacy team_member fallback: {team_member_fallback}")
    print(f"Unresolved: {unresolved}")
    print(f"Eligible for explicit baseline HR migration: {migratable}")


if __name__ == "__main__":
    asyncio.run(main())
