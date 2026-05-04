"""
Import Pool Shutdown schedule (Apr 10–18) into an existing Pulse project.

Creates tasks from `pool_shutdown_task_blueprint.py`, wires `PulseTaskDependency`
edges, and sets planning fields (start_date, due_date, phase_group, priority).

Usage (from `backend/` directory)
----------------------------------
  set POOL_SHUTDOWN_PROJECT_ID=<uuid>
  python -m scripts.import_pool_shutdown_schedule

  # Replace all tasks in the project first (destructive):
  python -m scripts.import_pool_shutdown_schedule --replace

  # Write JSON bundle to repo docs/ (no DB):
  python -m scripts.import_pool_shutdown_schedule --emit-json

Requires DATABASE_URL in `.env` (same as the API).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from collections import defaultdict, deque
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv

load_dotenv(_ROOT / ".env")

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.modules.pulse import project_service as proj_svc
from app.models.pulse_models import (
    PulseProject,
    PulseProjectTask,
    PulseTaskDependency,
    PulseTaskPriority,
    PulseTaskStatus,
)
from scripts.pool_shutdown_task_blueprint import SD, blueprint_to_jsonable, build_pool_shutdown_tasks


def _area_slug(area: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", area.strip().lower()).strip("_")
    return (s[:120] or "area")


def _topo_order(rows: list[SD]) -> list[SD]:
    ref_set = {r.ref for r in rows}
    missing: list[tuple[str, str]] = []
    for r in rows:
        for d in r.depends_on:
            if d not in ref_set:
                missing.append((r.ref, d))
    if missing:
        raise SystemExit(f"Missing dependency refs: {missing[:10]}")

    indeg: dict[str, int] = {r.ref: 0 for r in rows}
    adj: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        for d in r.depends_on:
            adj[d].append(r.ref)
            indeg[r.ref] += 1
    q = deque([ref for ref, deg in indeg.items() if deg == 0])
    out_refs: list[str] = []
    while q:
        u = q.popleft()
        out_refs.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(out_refs) != len(rows):
        raise SystemExit("Blueprint has a cycle or disconnected refs.")
    by_ref = {r.ref: r for r in rows}
    return [by_ref[r] for r in out_refs]


def _emit_json(out_path: Path) -> None:
    rows = build_pool_shutdown_tasks()
    payload = {
        "project_name": "Pool Shutdown",
        "date_range": {"start": "2026-04-10", "end": "2026-04-18"},
        "methodology": "Original shutdownlist line items only; minimal deps (tile→grout, grout→paint/changeroom, caulk after grout on pools); Apr 10–18 dates; no synthetic lag tasks.",
        "tasks": blueprint_to_jsonable(rows),
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({len(payload['tasks'])} tasks)")


async def _run(project_id: str, *, replace: bool) -> None:
    from uuid import UUID

    try:
        UUID(project_id)
    except Exception as e:
        raise SystemExit(f"Invalid project id: {e}") from e

    rows = _topo_order(build_pool_shutdown_tasks())

    async with AsyncSessionLocal() as db:
        proj = await db.get(PulseProject, project_id)
        if not proj:
            raise SystemExit("Project not found.")
        cid = str(proj.company_id)

        if replace:
            tq = await db.execute(select(PulseProjectTask).where(PulseProjectTask.project_id == project_id))
            existing = list(tq.scalars().all())
            for t in existing:
                await proj_svc.delete_calendar_shift_for_task(db, t)
            tids = [str(x.id) for x in existing]
            if tids:
                await db.execute(delete(PulseTaskDependency).where(PulseTaskDependency.task_id.in_(tids)))
                await db.execute(
                    delete(PulseTaskDependency).where(PulseTaskDependency.depends_on_task_id.in_(tids))
                )
                await db.execute(delete(PulseProjectTask).where(PulseProjectTask.project_id == project_id))
                await db.flush()
            print(f"Removed {len(tids)} existing tasks from project.")

        id_by_ref: dict[str, str] = {}
        created: list[PulseProjectTask] = []

        for r in rows:
            pr = (
                PulseTaskPriority.critical
                if r.priority == "critical"
                else PulseTaskPriority.high
                if r.priority == "high"
                else PulseTaskPriority.low
                if r.priority == "low"
                else PulseTaskPriority.medium
            )
            desc = (r.description or "").strip()
            if f"import_key:{r.ref}" not in desc:
                desc = f"{desc}\nimport_key:{r.ref}".strip()

            t = PulseProjectTask(
                company_id=cid,
                project_id=project_id,
                title=r.title.strip()[:512],
                description=desc,
                priority=pr,
                status=PulseTaskStatus.todo,
                start_date=r.start,
                due_date=r.due,
                estimated_completion_minutes=int((r.due - r.start).days + 1) * 1440,
                phase_group=r.phase[:128],
                location_tag_id=_area_slug(r.area),
            )
            db.add(t)
            await db.flush()
            id_by_ref[r.ref] = str(t.id)
            created.append(t)

        for r in rows:
            tid = id_by_ref[r.ref]
            for dep_ref in r.depends_on:
                dep_id = id_by_ref[dep_ref]
                row = PulseTaskDependency(task_id=tid, depends_on_task_id=dep_id)
                db.add(row)

        for t in created:
            await proj_svc.ensure_calendar_shift_for_task(db, cid, t)

        await db.commit()
        print(f"Imported {len(rows)} tasks + dependencies into project {project_id}.")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--project-id", default="", help="Pulse project UUID (or env POOL_SHUTDOWN_PROJECT_ID).")
    p.add_argument("--replace", action="store_true", help="Delete all tasks in the project before import.")
    p.add_argument(
        "--emit-json",
        action="store_true",
        help=f"Write docs/pool-shutdown-tasks-apr-10-18.json under repo root and exit.",
    )
    args = p.parse_args()

    repo_root = _ROOT.parent
    json_path = repo_root / "docs" / "pool-shutdown-tasks-apr-10-18.json"

    if args.emit_json:
        _emit_json(json_path)
        return

    import os

    pid = (args.project_id or os.getenv("POOL_SHUTDOWN_PROJECT_ID", "")).strip()
    if not pid:
        raise SystemExit("Set --project-id or POOL_SHUTDOWN_PROJECT_ID.")

    asyncio.run(_run(pid, replace=bool(args.replace)))


if __name__ == "__main__":
    main()
