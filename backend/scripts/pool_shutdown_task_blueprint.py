"""
Pool Shutdown — April 10–18 critical-path + parallel task blueprint.

Used by `import_pool_shutdown_schedule.py` and emitted as JSON for docs/tooling.
Lag / cure sequencing is modeled with explicit “lag hold” tasks so dependencies
block paint, reassembly, and water exposure until grout/caulk cures complete.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

PathKind = Literal["critical", "parallel"]


@dataclass(frozen=True)
class SD:
    """Single scheduled task row."""

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
    """Full schedule: inspection/demo first; tile→grout→cure→caulk→cure→finishes; parallel mechanical/features in windows."""
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

    # —— Phase 1: gates ——
    add(
        "G-SAFETY",
        "Shutdown kickoff + safety / lockout coordination",
        "Brief crews on LOTO, chemical handling, and wet-area sequencing. REF:G-SAFETY",
        "Facility",
        "PH1",
        d10,
        d10,
        (),
        "high",
        "parallel",
    )
    add(
        "G-INSP-ALL",
        "Facility-wide inspection: tiles, joints, fixtures, wet seals",
        "Document failures; photo log for rework avoidance next shutdown. Drives all demo scopes. REF:G-INSP-ALL",
        "Facility",
        "PH1",
        d10,
        d11,
        ("G-SAFETY",),
        "critical",
        "critical",
    )

    # —— Phase 1: demolition / prep (wet areas) ——
    add(
        "G-DEMO-POOLS",
        "Pools: remove failed grout, caulking, and damaged tile (all vessels)",
        "Prep all pool shells for tile repair wave. REF:G-DEMO-POOLS",
        "Lap Pool; Leisure Pool; Swirl Pool",
        "PH1",
        d10,
        d11,
        ("G-INSP-ALL",),
        "critical",
        "critical",
    )
    add(
        "SR-DEMO",
        "Steam room: remove failed grout/caulk and damaged tile",
        "Includes inlet-adjacent failures called out in master list. REF:SR-DEMO",
        "Steam Room",
        "PH1",
        d10,
        d11,
        ("G-INSP-ALL",),
        "critical",
        "critical",
    )

    # —— Steam room critical path ——
    add(
        "SR-TILE",
        "Steam room: tile repair (walls/floor, steam inlet zone)",
        "Repair broken pieces under steam inlet per shutdown list. REF:SR-TILE",
        "Steam Room",
        "PH2",
        d11,
        d12,
        ("SR-DEMO",),
        "critical",
        "critical",
    )
    add(
        "SR-GROUT",
        "Steam room: grout walls and floors",
        "Starts after tile repair + 1d cure buffer (scheduled). REF:SR-GROUT",
        "Steam Room",
        "PH3",
        d13,
        d14,
        ("SR-TILE",),
        "critical",
        "critical",
    )
    add(
        "SR-LAG-GROUT",
        "Steam room: grout cure hold (min 2d before caulk / paint exposure)",
        "Lag task — no shortcuts. REF:SR-LAG-GROUT",
        "Steam Room",
        "PH3",
        d14,
        d16,
        ("SR-GROUT",),
        "critical",
        "critical",
    )
    add(
        "SR-CAULK",
        "Steam room: caulking / perimeter seals after grout cure",
        "REF:SR-CAULK",
        "Steam Room",
        "PH4",
        d16,
        d16,
        ("SR-LAG-GROUT",),
        "critical",
        "critical",
    )
    add(
        "SR-LAG-CAULK",
        "Steam room: sealant cure before heavy cleaning / recommission",
        "1–2d lag before final wet scrub counts as complete. REF:SR-LAG-CAULK",
        "Steam Room",
        "PH4",
        d17,
        d17,
        ("SR-CAULK",),
        "critical",
        "critical",
    )
    add(
        "SR-SCRUB",
        "Steam room: scrub walls and floors (non-destructive)",
        "Parallel where safe; finish quality before final disinfection. REF:SR-SCRUB",
        "Steam Room",
        "PH5",
        d11,
        d14,
        ("SR-DEMO",),
        "medium",
        "parallel",
    )
    add(
        "SR-GEN-SVC",
        "Steam generator: drain, clean, flush, replace sensors",
        "Mechanical lane during cure windows. REF:SR-GEN-SVC",
        "Steam Room",
        "PH5",
        d12,
        d16,
        ("G-INSP-ALL",),
        "high",
        "parallel",
    )
    add(
        "SR-GEN-COVER",
        "Steam generator: remove and clean cover",
        "REF:SR-GEN-COVER",
        "Steam Room",
        "PH5",
        d12,
        d13,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )
    add(
        "SR-FINAL-CLEAN",
        "Steam room: full clean + disinfection",
        "After sealant cure and generator service lane complete. REF:SR-FINAL-CLEAN",
        "Steam Room",
        "PH7",
        d17,
        d18,
        ("SR-LAG-CAULK", "SR-GEN-SVC"),
        "high",
        "critical",
    )

    # —— Changeroom template (Family / Mens / Womens) ——
    cr_specs: list[tuple[str, str]] = [
        ("FCR", "Family Changeroom"),
        ("MCR", "Mens Changeroom"),
        ("WCR", "Womens Changeroom"),
    ]
    for code, area_name in cr_specs:
        add(
            f"{code}-DEMO",
            f"{area_name}: remove failed grout/caulk and damaged tile",
            "Demolition lane after inspection. REF:%s-DEMO" % code,
            area_name,
            "PH1",
            d10,
            d11,
            ("G-INSP-ALL",),
            "critical",
            "critical",
        )
        add(
            f"{code}-TILE",
            f"{area_name}: tile repair",
            "REF:%s-TILE" % code,
            area_name,
            "PH2",
            d11,
            d13,
            (f"{code}-DEMO",),
            "critical",
            "critical",
        )
        add(
            f"{code}-GROUT",
            f"{area_name}: grout tile",
            "Starts after tile repair + 1d buffer. REF:%s-GROUT" % code,
            area_name,
            "PH3",
            d13,
            d14,
            (f"{code}-TILE",),
            "critical",
            "critical",
        )
        add(
            f"{code}-LAG-GROUT",
            f"{area_name}: grout cure hold (min 2d) before caulk / paint",
            "Lag task. REF:%s-LAG-GROUT" % code,
            area_name,
            "PH3",
            d14,
            d16,
            (f"{code}-GROUT",),
            "critical",
            "critical",
        )
        add(
            f"{code}-CAULK",
            f"{area_name}: caulking / wet-area perimeter seals",
            "After grout cure. REF:%s-CAULK" % code,
            area_name,
            "PH4",
            d16,
            d16,
            (f"{code}-LAG-GROUT",),
            "critical",
            "critical",
        )
        add(
            f"{code}-LAG-CAULK",
            f"{area_name}: sealant cure before grate reinstall / heavy use",
            "REF:%s-LAG-CAULK" % code,
            area_name,
            "PH4",
            d17,
            d17,
            (f"{code}-CAULK",),
            "critical",
            "critical",
        )
        # Parallel / dry work (shutdown list)
        add(
            f"{code}-SCRUB-F",
            f"{area_name}: scrub floors",
            "REF:%s-SCRUB-F" % code,
            area_name,
            "PH5",
            d11,
            d12,
            (f"{code}-DEMO",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-PW-WALL",
            f"{area_name}: powerwash or scrub walls",
            "REF:%s-PW-WALL" % code,
            area_name,
            "PH5",
            d11,
            d13,
            (f"{code}-DEMO",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-DUST",
            f"{area_name}: dust vents, locker tops, partitions, lights, ceilings",
            "REF:%s-DUST" % code,
            area_name,
            "PH5",
            d11,
            d16,
            (f"{code}-DEMO",),
            "low",
            "parallel",
        )
        add(
            f"{code}-LKR",
            f"{area_name}: inspect / repair locker mechanisms",
            "REF:%s-LKR" % code,
            area_name,
            "PH5",
            d12,
            d15,
            (f"{code}-DEMO",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-PLUMB",
            f"{area_name}: inspect toilets, sinks, showers (leaks / damage)",
            "REF:%s-PLUMB" % code,
            area_name,
            "PH5",
            d12,
            d15,
            (f"{code}-DEMO",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-PAINT",
            f"{area_name}: paint partitions, walls, ceilings",
            "Only after grout cure hold completes (moisture rule). REF:%s-PAINT" % code,
            area_name,
            "PH6",
            d16,
            d17,
            (f"{code}-LAG-GROUT",),
            "high",
            "parallel",
        )
        add(
            f"{code}-GRATES",
            f"{area_name}: inspect and clean grates",
            "After caulk cure where grates interface wet seals. REF:%s-GRATES" % code,
            area_name,
            "PH7",
            d17,
            d17,
            (f"{code}-LAG-CAULK",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-SS-POLISH",
            f"{area_name}: polish stainless steel",
            "REF:%s-SS-POLISH" % code,
            area_name,
            "PH6",
            d16,
            d17,
            (f"{code}-LAG-GROUT",),
            "low",
            "parallel",
        )
        add(
            f"{code}-LIGHTS",
            f"{area_name}: change light tubes or ballasts (as needed)",
            "REF:%s-LIGHTS" % code,
            area_name,
            "PH5",
            d12,
            d16,
            (f"{code}-DEMO",),
            "low",
            "parallel",
        )
        add(
            f"{code}-DOORS-SEAL",
            f"{area_name}: check rubber seals on doors",
            "REF:%s-DOORS-SEAL" % code,
            area_name,
            "PH5",
            d12,
            d15,
            (f"{code}-DEMO",),
            "low",
            "parallel",
        )
        add(
            f"{code}-DOORS-HW",
            f"{area_name}: check door hardware",
            "REF:%s-DOORS-HW" % code,
            area_name,
            "PH5",
            d12,
            d15,
            (f"{code}-DEMO",),
            "low",
            "parallel",
        )
        add(
            f"{code}-PARTITIONS",
            f"{area_name}: inspect partitions for structural damage / movement",
            "REF:%s-PARTITIONS" % code,
            area_name,
            "PH5",
            d12,
            d15,
            (f"{code}-DEMO",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-SHOWER-HEAD",
            f"{area_name}: remove and clean shower heads",
            "REF:%s-SHOWER-HEAD" % code,
            area_name,
            "PH5",
            d13,
            d15,
            (f"{code}-GROUT",),
            "medium",
            "parallel",
        )
        add(
            f"{code}-SHOWER-BTN",
            f"{area_name}: clean / repair shower buttons",
            "REF:%s-SHOWER-BTN" % code,
            area_name,
            "PH5",
            d13,
            d15,
            (f"{code}-GROUT",),
            "low",
            "parallel",
        )
        add(
            f"{code}-FINAL-CLEAN",
            f"{area_name}: full clean + disinfection",
            "Closeout after paint / hardware / grate lane. REF:%s-FINAL-CLEAN" % code,
            area_name,
            "PH7",
            d17,
            d18,
            (f"{code}-PAINT", f"{code}-GRATES", f"{code}-SHOWER-HEAD"),
            "high",
            "parallel",
        )

    def pool_chain(prefix: str, area_name: str, *, scrub_ss: bool) -> None:
        add(
            f"{prefix}-DEMO",
            f"{area_name}: remove failed grout, caulking, damaged tile",
            "Tied to global pools demo wave where overlap applies. REF:%s-DEMO" % prefix,
            area_name,
            "PH1",
            d10,
            d11,
            ("G-DEMO-POOLS",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-TILE",
            f"{area_name}: tile repair",
            "REF:%s-TILE" % prefix,
            area_name,
            "PH2",
            d11,
            d13,
            (f"{prefix}-DEMO",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-GROUT",
            f"{area_name}: grout tile",
            "REF:%s-GROUT" % prefix,
            area_name,
            "PH3",
            d13,
            d14,
            (f"{prefix}-TILE",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-LAG-GROUT",
            f"{area_name}: grout cure hold (2–3d) before water exposure / caulk stress",
            "Lag task. REF:%s-LAG-GROUT" % prefix,
            area_name,
            "PH3",
            d14,
            d16,
            (f"{prefix}-GROUT",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-CAULK",
            f"{area_name}: re-caulk expansion joints / wet transitions",
            "REF:%s-CAULK" % prefix,
            area_name,
            "PH4",
            d16,
            d16,
            (f"{prefix}-LAG-GROUT",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-LAG-CAULK",
            f"{area_name}: sealant cure before grate reinstall / refilling",
            "REF:%s-LAG-CAULK" % prefix,
            area_name,
            "PH4",
            d17,
            d17,
            (f"{prefix}-CAULK",),
            "critical",
            "critical",
        )
        add(
            f"{prefix}-MECH",
            f"{area_name}: jets/covers, drains, lights (as listed)",
            "Parallel mechanical lane. REF:%s-MECH" % prefix,
            area_name,
            "PH5",
            d11,
            d16,
            ("G-INSP-ALL",),
            "high",
            "parallel",
        )
        add(
            f"{prefix}-SCRUB",
            f"{area_name}: full scrub (scum line emphasis)",
            "Water exposure lane after grout cure hold. REF:%s-SCRUB" % prefix,
            area_name,
            "PH6",
            d16,
            d17,
            (f"{prefix}-LAG-GROUT",),
            "high",
            "parallel",
        )
        if scrub_ss:
            add(
                f"{prefix}-SS",
                f"{area_name}: polish stainless steel",
                "REF:%s-SS" % prefix,
                area_name,
                "PH6",
                d16,
                d17,
                (f"{prefix}-LAG-GROUT",),
                "low",
                "parallel",
            )

    pool_chain("LAP", "Lap Pool", scrub_ss=False)
    pool_chain("LEI", "Leisure Pool", scrub_ss=True)
    pool_chain("SWI", "Swirl Pool", scrub_ss=False)

    add(
        "LAP-HYDRO",
        "Lap pool: charge filters, clean cells, repair chlorinator boards",
        "Mechanical closeout lane. REF:LAP-HYDRO",
        "Lap Pool",
        "PH5",
        d12,
        d17,
        ("G-INSP-ALL",),
        "high",
        "parallel",
    )

    # —— Features & equipment ——
    add(
        "FEAT-DIVE",
        "Diving board: scrub, bleach or repaint; inspect bolts; polish stainless",
        "REF:FEAT-DIVE",
        "Features & Equipment",
        "PH5",
        d11,
        d16,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )
    add(
        "FEAT-PIPE",
        "Pipe falls: inspect/replace anodes; remove rust and repaint",
        "REF:FEAT-PIPE",
        "Features & Equipment",
        "PH5",
        d11,
        d16,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )
    add(
        "FEAT-WALL",
        "Climbing wall: powerwash, scrub grips, inspect hardware",
        "REF:FEAT-WALL",
        "Features & Equipment",
        "PH5",
        d11,
        d15,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )
    add(
        "FEAT-KIDS",
        "Leisure pool kids features: function test, rust/repaint, bleach teacup, clean, purge airlines",
        "REF:FEAT-KIDS",
        "Features & Equipment",
        "PH5",
        d12,
        d17,
        ("G-DEMO-POOLS",),
        "high",
        "parallel",
    )
    add(
        "FEAT-BLOCK",
        "Diving blocks: inspect hardware/damage; degrease, scrub, disinfect",
        "REF:FEAT-BLOCK",
        "Features & Equipment",
        "PH5",
        d12,
        d16,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )

    add(
        "MECH-STEAM-FEED",
        "Mechanical: steam system checks tied to generator service window",
        "Cross-coord with steam generator tasks. REF:MECH-STEAM-FEED",
        "Features & Equipment",
        "PH5",
        d12,
        d16,
        ("G-INSP-ALL",),
        "medium",
        "parallel",
    )
    add(
        "MECH-FILTERS-GLOBAL",
        "Mechanical: filters, chlorinator, jets, drains, lights (facility-wide pass)",
        "Fills cure windows with crew efficiency. REF:MECH-FILTERS-GLOBAL",
        "Features & Equipment",
        "PH5",
        d11,
        d17,
        ("G-INSP-ALL",),
        "high",
        "parallel",
    )

    # —— Phase 7: reassembly + startup (after last caulk cures) ——
    add(
        "G-REINSTALL-GRATES",
        "Reinstall pool grates / covers after caulk cure (all vessels)",
        "Depends on last vessel caulk-cure tasks. REF:G-REINSTALL-GRATES",
        "Facility",
        "PH7",
        d17,
        d18,
        ("LAP-LAG-CAULK", "LEI-LAG-CAULK", "SWI-LAG-CAULK"),
        "critical",
        "critical",
    )
    add(
        "G-FIXTURES-HW",
        "Reinstall fixtures / hardware checks (wet decks)",
        "REF:G-FIXTURES-HW",
        "Facility",
        "PH7",
        d17,
        d18,
        ("G-REINSTALL-GRATES",),
        "medium",
        "parallel",
    )
    add(
        "G-WATER-QUALITY",
        "System startup + water balance + disinfection verification",
        "Final commissioning gate. REF:G-WATER-QUALITY",
        "Facility",
        "PH7",
        d17,
        d18,
        ("G-FIXTURES-HW", "LAP-HYDRO", "MECH-FILTERS-GLOBAL"),
        "critical",
        "critical",
    )

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
