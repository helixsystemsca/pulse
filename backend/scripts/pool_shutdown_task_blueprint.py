"""
Pool Shutdown — April 10–18 schedule aligned to the original `shutdownlist.md` line items.

- One Pulse task per checklist line (Family / Mens / Womens each get the same 17 items).
- **Minimal dependencies** so Gantt / network / resource views stay readable:
  only **tile repair → grout**, **grout → paint** (changerooms), and **tile → grout** on pools / steam
  where both exist.
- No synthetic “lag hold” tasks; spacing is in **start/due dates** only.
- Priorities are mostly **medium**; **high** only on grout (finish-sensitive). No `critical` priority
  and no `[CRITICAL]` title prefix (importer does not add one).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

PathKind = Literal["critical", "parallel"]


@dataclass(frozen=True)
class SD:
    ref: str
    title: str
    description: str
    area: str
    phase: str
    start: date
    due: date
    depends_on: tuple[str, ...]
    priority: Literal["critical", "high", "medium", "low"]
    path: PathKind


def _d(y: int, m: int, d: int) -> date:
    return date(y, m, d)


def _inclusive_days(a: date, b: date) -> int:
    return max(1, (b - a).days + 1)


def _est_minutes(a: date, b: date) -> int:
    return _inclusive_days(a, b) * 1440


def build_pool_shutdown_tasks() -> list[SD]:
    y = 2026
    d10, d11, d12, d13, d14, d15, d16, d17, d18 = (
        _d(y, 4, 10),
        _d(y, 4, 11),
        _d(y, 4, 12),
        _d(y, 4, 13),
        _d(y, 4, 14),
        _d(y, 4, 15),
        _d(y, 4, 16),
        _d(y, 4, 17),
        _d(y, 4, 18),
    )
    out: list[SD] = []

    def add(
        ref: str,
        title: str,
        desc: str,
        area: str,
        phase: str,
        start: date,
        due: date,
        depends: tuple[str, ...] = (),
        priority: Literal["critical", "high", "medium", "low"] = "medium",
        path: PathKind = "parallel",
    ) -> None:
        out.append(
            SD(
                ref=ref,
                title=title,
                description=desc,
                area=area,
                phase=phase,
                start=start,
                due=due,
                depends_on=depends,
                priority=priority,
                path=path,
            )
        )

    # —— Steam Room (original 6 lines) ——
    add("SR-scrub", "Steam room: scrub walls and floors", "Original shutdown list.", "Steam Room", "P1", d10, d11, (), "medium", "parallel")
    add("SR-tile", "Steam room: tile broken pieces under steam inlet", "Original shutdown list.", "Steam Room", "P2", d11, d12, ("SR-scrub",), "medium", "parallel")
    add("SR-grout", "Steam room: grout walls and floors", "Original shutdown list.", "Steam Room", "P3", d13, d14, ("SR-tile",), "high", "parallel")
    add("SR-gen-cover", "Steam room: remove and clean steam generator cover", "Original shutdown list.", "Steam Room", "P1", d11, d12, (), "medium", "parallel")
    add("SR-gen-svc", "Steam room: generator — drain, clean, flush, replace sensors", "Original shutdown list.", "Steam Room", "P4", d14, d16, (), "medium", "parallel")
    add("SR-full-clean", "Steam room: full clean of room", "Original shutdown list.", "Steam Room", "P5", d17, d18, ("SR-grout",), "medium", "parallel")

    # —— Changerooms: same 17 substantive lines × 3 ——
    cr_specs: list[tuple[str, str]] = [
        ("FCR", "Family Changeroom"),
        ("MCR", "Mens Changeroom"),
        ("WCR", "Womens Changeroom"),
    ]
    # (slug, title tail, start, due, depends on refs within same room — empty, or "tile"/"grout" keys)
    cr_lines: list[tuple[str, str, date, date, tuple[str, ...]]] = [
        ("scrub-floors", "scrub floors", d10, d11, ()),
        ("pw-walls", "powerwash or scrub walls", d10, d12, ()),
        ("dust", "dust everything (vents, locker tops, partitions, lights, ceilings)", d11, d14, ()),
        ("lockers", "inspect and repair/replace damaged locker mechanisms", d12, d14, ()),
        ("plumb", "inspect toilets, sinks, and showers for leaks and damage", d12, d14, ()),
        ("tile", "tile repair", d11, d13, ()),
        ("grout", "grout tile", d13, d15, ("tile",)),
        ("paint", "paint (partitions, walls, ceilings)", d16, d17, ("grout",)),
        ("grates", "inspect and clean grates", d16, d17, ()),
        ("ss", "polish stainless steel", d16, d17, ()),
        ("lights", "change light tubes or ballasts", d12, d16, ()),
        ("door-seals", "check rubber seals on doors", d12, d15, ()),
        ("door-hw", "check door hardware", d12, d15, ()),
        ("partitions", "inspect partitions for structural damage and movement", d12, d15, ()),
        ("shower-heads", "remove and clean shower heads", d15, d16, ("grout",)),
        ("shower-btns", "clean/repair shower buttons", d15, d16, ("grout",)),
        ("final", "full clean and disinfection", d17, d18, ("grout", "paint")),
    ]

    for code, area_name in cr_specs:
        for slug, tail, ds, de, dep_keys in cr_lines:
            ref = f"{code}-{slug}"
            deps: tuple[str, ...] = tuple(f"{code}-{k}" for k in dep_keys)
            pr: Literal["critical", "high", "medium", "low"] = "high" if slug == "grout" else "medium"
            add(
                ref,
                f"{area_name}: {tail}",
                "Original shutdown list.",
                area_name,
                "P1" if ds <= d11 else "P2" if ds <= d13 else "P3",
                ds,
                de,
                deps,
                pr,
                "parallel",
            )

    # —— Toys and Features (5 headings from original) ——
    add(
        "FEAT-diving",
        "Toys & features: diving board — scrub, bleach or re-paint; inspect bolts and hardware; polish stainless",
        "Original shutdown list.",
        "Toys and Features",
        "P2",
        d11,
        d16,
        (),
        "medium",
        "parallel",
    )
    add(
        "FEAT-pipe",
        "Toys & features: pipe falls — inspect and replace anodes; remove rust and repaint",
        "Original shutdown list.",
        "Toys and Features",
        "P2",
        d11,
        d16,
        (),
        "medium",
        "parallel",
    )
    add(
        "FEAT-wall",
        "Toys & features: climbing wall — powerwash wall, scrub grips, inspect hardware",
        "Original shutdown list.",
        "Toys and Features",
        "P2",
        d11,
        d15,
        (),
        "medium",
        "parallel",
    )
    add(
        "FEAT-kids",
        "Toys & features: leisure pool kids features — function test; rust/repaint; bleach teacup; full clean; purge airlines",
        "Original shutdown list.",
        "Toys and Features",
        "P2",
        d12,
        d17,
        (),
        "medium",
        "parallel",
    )
    add(
        "FEAT-blocks",
        "Toys & features: diving blocks — inspect hardware; inspect for damage; degrease and scrub; disinfect",
        "Original shutdown list.",
        "Toys and Features",
        "P2",
        d12,
        d16,
        (),
        "medium",
        "parallel",
    )

    # —— Swirl Pool ——
    add("SWI-jets", "Swirl pool: inspect and repair jets/covers", "Original shutdown list.", "Swirl Pool", "P2", d11, d13, (), "medium", "parallel")
    add("SWI-caulk", "Swirl pool: re-caulk expansion joints", "Original shutdown list.", "Swirl Pool", "P4", d15, d16, ("SWI-grout",), "medium", "parallel")
    add("SWI-drains", "Swirl pool: inspect drains", "Original shutdown list.", "Swirl Pool", "P2", d12, d14, (), "medium", "parallel")
    add("SWI-lights", "Swirl pool: replace dead lights", "Original shutdown list.", "Swirl Pool", "P2", d12, d15, (), "medium", "parallel")
    add("SWI-scrub", "Swirl pool: full scrub (especially scum line)", "Original shutdown list.", "Swirl Pool", "P3", d14, d16, (), "medium", "parallel")
    add("SWI-tile", "Swirl pool: tile repair", "Original shutdown list.", "Swirl Pool", "P2", d11, d13, (), "medium", "parallel")
    add("SWI-grout", "Swirl pool: grout tile", "Original shutdown list.", "Swirl Pool", "P3", d13, d15, ("SWI-tile",), "high", "parallel")

    # —— Leisure Pool ——
    add("LEI-jets", "Leisure pool: inspect and repair jets/covers", "Original shutdown list.", "Leisure Pool", "P2", d11, d13, (), "medium", "parallel")
    add("LEI-caulk", "Leisure pool: re-caulk expansion joints", "Original shutdown list.", "Leisure Pool", "P4", d15, d16, ("LEI-grout",), "medium", "parallel")
    add("LEI-drains", "Leisure pool: inspect drains", "Original shutdown list.", "Leisure Pool", "P2", d12, d14, (), "medium", "parallel")
    add("LEI-lights", "Leisure pool: replace dead lights", "Original shutdown list.", "Leisure Pool", "P2", d12, d15, (), "medium", "parallel")
    add("LEI-scrub", "Leisure pool: full scrub (especially scum line)", "Original shutdown list.", "Leisure Pool", "P3", d14, d16, (), "medium", "parallel")
    add("LEI-tile", "Leisure pool: tile repair", "Original shutdown list.", "Leisure Pool", "P2", d11, d13, (), "medium", "parallel")
    add("LEI-grout", "Leisure pool: grout tile", "Original shutdown list.", "Leisure Pool", "P3", d13, d15, ("LEI-tile",), "high", "parallel")
    add("LEI-ss", "Leisure pool: polish stainless steel", "Original shutdown list.", "Leisure Pool", "P4", d16, d17, (), "medium", "parallel")

    # —— Lap Pool ——
    add("LAP-tile", "Lap pool: tile repair", "Original shutdown list.", "Lap Pool", "P2", d11, d13, (), "medium", "parallel")
    add("LAP-grout", "Lap pool: grout tile", "Original shutdown list.", "Lap Pool", "P3", d13, d15, ("LAP-tile",), "high", "parallel")
    add("LAP-filters", "Lap pool: charge filters", "Original shutdown list.", "Lap Pool", "P4", d12, d16, (), "medium", "parallel")
    add("LAP-cells", "Lap pool: clean cells", "Original shutdown list.", "Lap Pool", "P4", d12, d16, (), "medium", "parallel")
    add("LAP-chlor", "Lap pool: repair chlorinator electronic boards", "Original shutdown list.", "Lap Pool", "P4", d14, d17, (), "medium", "parallel")

    return out


def blueprint_to_jsonable(rows: list[SD]) -> list[dict]:
    return [
        {
            "ref": r.ref,
            "import_key": r.ref,
            "title": r.title,
            "description": r.description,
            "area": r.area,
            "phase": r.phase,
            "start_date": r.start.isoformat(),
            "end_date": r.due.isoformat(),
            "estimated_completion_minutes": _est_minutes(r.start, r.due),
            "depends_on_refs": list(r.depends_on),
            "priority": r.priority,
            "path": r.path,
        }
        for r in rows
    ]


__all__ = ["SD", "build_pool_shutdown_tasks", "blueprint_to_jsonable", "_est_minutes"]
