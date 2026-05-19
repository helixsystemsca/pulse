"""
Per-day employee availability for the manual schedule builder.

Auxiliary logic (summary):
- **unavailable** — hard block; drag/drop prevented.
- **available** — confirmed/preferred window; drop allowed when shift fits time + restrictions.
- **conditional** — drop allowed with warning; `restriction_type` limits bands (days_only, gg_only, …).
- **open_pickup** — eligible but unconfirmed; drop allowed (blue highlight).
- **No row** — not unavailable; treated as pickup-eligible (blank ≠ blocked).

Future CSV / spreadsheet imports should call `import_availability_rows()` with the same row shape.
"""

from __future__ import annotations

import json
import logging
import time as time_mod
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional
from uuid import uuid4

from sqlalchemy import and_, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import User
from app.models.pulse_models import EmployeeAvailability

_log = logging.getLogger(__name__)

STATUSES = frozenset({"available", "unavailable", "conditional", "open_pickup"})
RESTRICTIONS = frozenset(
    {
        "days_only",
        "afternoons_only",
        "nights_only",
        "gg_only",
        "day_afternoon_only",
        "overnight_only",
    }
)

SEED_SOURCE = "development_seed"
SEED_IMPORTED_FROM = "june_aux_sheet"
JUNE_2026_START = date(2026, 6, 1)
JUNE_2026_END = date(2026, 6, 30)

_DATASET_PATH = Path(__file__).resolve().parent / "data" / "june_2026_aux_availability.json"


def expand_date_range(start: date, end: date) -> list[date]:
    if end < start:
        raise ValueError("end before start")
    out: list[date] = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def dates_in_month(year: int, month: int) -> list[date]:
    return expand_date_range(date(year, month, 1), date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31))


def weekdays_in_range(start: date, end: date, weekday: int) -> list[date]:
    """weekday: Monday=0 … Sunday=6 (datetime.weekday)."""
    return [d for d in expand_date_range(start, end) if d.weekday() == weekday]


def _parse_hm(raw: str) -> time:
    parts = raw.strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"invalid time: {raw}")
    return time(int(parts[0]), int(parts[1]))


def create_availability_entry(
    *,
    employee_id: str,
    on_date: date,
    status: str,
    start_time: Optional[time] = None,
    end_time: Optional[time] = None,
    restriction_type: Optional[str] = None,
    notes: Optional[str] = None,
    source: str = "manual",
    imported_from: Optional[str] = None,
) -> dict[str, Any]:
    st = status.strip().lower()
    if st not in STATUSES:
        raise ValueError(f"invalid status: {status}")
    rt = restriction_type.strip().lower() if restriction_type else None
    if rt and rt not in RESTRICTIONS:
        raise ValueError(f"invalid restriction_type: {restriction_type}")
    if start_time and end_time and start_time >= end_time and st == "available":
        # overnight available windows allowed when end < start; only reject same-day inverted ranges
        if end_time > start_time:
            pass
        elif start_time == end_time:
            raise ValueError("start_time must differ from end_time")
    return {
        "employee_id": employee_id,
        "date": on_date,
        "status": st,
        "start_time": start_time,
        "end_time": end_time,
        "restriction_type": rt,
        "notes": notes,
        "source": source,
        "imported_from": imported_from,
    }


def _slot_key(row: dict[str, Any]) -> tuple:
    return (
        row["employee_id"],
        row["date"],
        row["status"],
        row.get("restriction_type"),
    )


def validate_no_conflicts(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Drop duplicate slots; reject conflicting status on same employee+date."""
    seen_slots: set[tuple] = set()
    by_day: dict[tuple[str, date], set[str]] = {}
    out: list[dict[str, Any]] = []
    skipped = 0
    for row in rows:
        sk = _slot_key(row)
        if sk in seen_slots:
            skipped += 1
            continue
        day_key = (row["employee_id"], row["date"])
        statuses = by_day.setdefault(day_key, set())
        if row["status"] == "unavailable" and statuses - {"unavailable"}:
            skipped += 1
            continue
        if "unavailable" in statuses and row["status"] != "unavailable":
            skipped += 1
            continue
        seen_slots.add(sk)
        statuses.add(row["status"])
        out.append(row)
    return out, skipped


@dataclass
class SeedRunResult:
    employees_matched: int = 0
    employees_missing: list[str] = field(default_factory=list)
    entries_created: int = 0
    entries_skipped_duplicates: int = 0
    wiped_rows: int = 0
    execution_ms: int = 0


def _load_dataset() -> list[dict[str, Any]]:
    with _DATASET_PATH.open(encoding="utf-8") as f:
        return json.load(f)["workers"]


def _expand_worker_spec(employee_id: str, spec: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    common = {"employee_id": employee_id, "source": SEED_SOURCE, "imported_from": SEED_IMPORTED_FROM}

    for d in spec.get("unavailable_dates", []):
        rows.append(create_availability_entry(on_date=date.fromisoformat(d), status="unavailable", **common))

    for d in spec.get("open_pickup_dates", []):
        rows.append(create_availability_entry(on_date=date.fromisoformat(d), status="open_pickup", **common))

    for item in spec.get("entries", []):
        rows.append(
            create_availability_entry(
                on_date=date.fromisoformat(item["date"]),
                status=item["status"],
                start_time=_parse_hm(item["start_time"]) if item.get("start_time") else None,
                end_time=_parse_hm(item["end_time"]) if item.get("end_time") else None,
                restriction_type=item.get("restriction_type"),
                notes=item.get("notes"),
                **common,
            )
        )

    for rec in spec.get("recurring", []):
        wd = int(rec["weekday"])
        for d in weekdays_in_range(JUNE_2026_START, JUNE_2026_END, wd):
            rows.append(
                create_availability_entry(
                    on_date=d,
                    status=rec["status"],
                    start_time=_parse_hm(rec["start_time"]) if rec.get("start_time") else None,
                    end_time=_parse_hm(rec["end_time"]) if rec.get("end_time") else None,
                    restriction_type=rec.get("restriction_type"),
                    notes=rec.get("notes"),
                    **common,
                )
            )

    if spec.get("open_pickup_all_june"):
        for d in expand_date_range(JUNE_2026_START, JUNE_2026_END):
            rows.append(create_availability_entry(on_date=d, status="open_pickup", **common))

    return rows


def _resolve_employee_id(workers_by_name: dict[str, str], display_name: str) -> Optional[str]:
    key = display_name.strip().lower()
    if key in workers_by_name:
        return workers_by_name[key]
    parts = key.split()
    if len(parts) >= 2:
        last_first = f"{parts[-1]}, {parts[0]}"
        if last_first in workers_by_name:
            return workers_by_name[last_first]
    for label, uid in workers_by_name.items():
        if key in label or label in key:
            return uid
    return None


def build_june_2026_seed_rows(workers_by_name: dict[str, str]) -> tuple[list[dict[str, Any]], list[str], int]:
    dataset = _load_dataset()
    all_rows: list[dict[str, Any]] = []
    missing: list[str] = []
    matched = 0
    for block in dataset:
        name = block["name"].strip()
        emp_id = _resolve_employee_id(workers_by_name, name)
        if not emp_id:
            missing.append(name)
            continue
        matched += 1
        all_rows.extend(_expand_worker_spec(emp_id, block))
    validated, _ = validate_no_conflicts(all_rows)
    return validated, missing, matched


async def resolve_workers_by_name(db: AsyncSession, company_id: str) -> dict[str, str]:
    q = await db.execute(
        select(User.id, User.full_name, User.email).where(
            User.company_id == company_id,
            User.is_active.is_(True),
        )
    )
    out: dict[str, str] = {}
    for uid, full_name, email in q.all():
        for label in (full_name, email):
            if label and str(label).strip():
                out[str(label).strip().lower()] = str(uid)
    return out


async def wipe_development_seed(
    db: AsyncSession,
    company_id: str,
    start: date,
    end: date,
) -> int:
    res = await db.execute(
        delete(EmployeeAvailability).where(
            EmployeeAvailability.company_id == company_id,
            EmployeeAvailability.source == SEED_SOURCE,
            EmployeeAvailability.date >= start,
            EmployeeAvailability.date <= end,
        )
    )
    return int(res.rowcount or 0)


async def list_employee_availability(
    db: AsyncSession,
    company_id: str,
    from_date: date,
    to_date: date,
    employee_ids: Optional[Iterable[str]] = None,
) -> list[EmployeeAvailability]:
    clauses = [
        EmployeeAvailability.company_id == company_id,
        EmployeeAvailability.date >= from_date,
        EmployeeAvailability.date <= to_date,
    ]
    if employee_ids is not None:
        ids = list(employee_ids)
        if not ids:
            return []
        clauses.append(EmployeeAvailability.employee_id.in_(ids))
    q = await db.execute(
        select(EmployeeAvailability).where(and_(*clauses)).order_by(
            EmployeeAvailability.employee_id,
            EmployeeAvailability.date,
        )
    )
    return list(q.scalars().all())


async def import_availability_rows(
    db: AsyncSession,
    company_id: str,
    rows: list[dict[str, Any]],
) -> tuple[int, int]:
    """Bulk insert validated rows; returns (created, skipped_duplicates)."""
    validated, skipped = validate_no_conflicts(rows)
    if not validated:
        return 0, skipped
    payload = []
    for row in validated:
        payload.append(
            {
                "id": str(uuid4()),
                "company_id": company_id,
                **row,
            }
        )
    stmt = pg_insert(EmployeeAvailability).values(payload)
    stmt = stmt.on_conflict_do_nothing(constraint="uq_employee_availability_day_slot")
    res = await db.execute(stmt)
    created = int(res.rowcount or 0)
    return created, skipped + (len(validated) - created)


async def seed_june_2026_auxiliary(
    db: AsyncSession,
    company_id: str,
) -> SeedRunResult:
    t0 = time_mod.perf_counter()
    result = SeedRunResult()
    result.wiped_rows = await wipe_development_seed(db, company_id, JUNE_2026_START, JUNE_2026_END)
    workers_by_name = await resolve_workers_by_name(db, company_id)
    rows, missing, matched = build_june_2026_seed_rows(workers_by_name)
    result.employees_missing = missing
    result.employees_matched = matched
    created, skipped = await import_availability_rows(db, company_id, rows)
    await db.commit()
    result.entries_created = created
    result.entries_skipped_duplicates = skipped
    result.execution_ms = int((time_mod.perf_counter() - t0) * 1000)
    _log.info(
        "seed_june_2026_auxiliary company=%s matched=%s created=%s skipped=%s wiped=%s ms=%s missing=%s",
        company_id,
        result.employees_matched,
        result.entries_created,
        result.entries_skipped_duplicates,
        result.wiped_rows,
        result.execution_ms,
        result.employees_missing,
    )
    return result
