"""Training / certification eligibility for schedule shift assignments.

Warn-only: missing or expired credentials must surface as alarms, not HTTP 400s.
Availability overlap and ticketed-supervisor rules stay in ``validate_shift_assignment``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulseScheduleShiftDefinition,
    PulseWorkerCertification,
    PulseWorkerProfile,
    PulseWorkerTraining,
)

# Human labels / HR names → canonical schedule codes (uppercase).
_CERT_SYNONYMS: dict[str, str] = {
    "RO": "RO",
    "REFRIGERATION OPERATOR": "RO",
    "P1": "P1",
    "POOL OPERATOR LEVEL 1": "P1",
    "POOL OPERATOR 1": "P1",
    "PO 1": "P1",
    "P2": "P2",
    "POOL OPERATOR LEVEL 2": "P2",
    "POOL OPERATOR 2": "P2",
    "PO 2": "P2",
    "P4": "P4",
    "4TH CLASS POWER ENGINEER": "P4",
    "FOURTH CLASS POWER ENGINEER": "P4",
    "FA": "FA",
    "FIRST AID": "FA",
    "WHMIS": "WHMIS",
    "FORKLIFT": "FORKLIFT",
    "FORKLIFT OPERATOR": "FORKLIFT",
}

CERT_LABELS: dict[str, str] = {
    "RO": "Refrigeration Operator",
    "P1": "Pool Operator Level 1",
    "P2": "Pool Operator Level 2",
    "P4": "4th Class Power Engineer",
    "FA": "First Aid",
    "WHMIS": "WHMIS",
    "FORKLIFT": "Forklift operator",
}


def normalize_credential_code(raw: str | None) -> str:
    if not raw:
        return ""
    key = " ".join(str(raw).strip().upper().split())
    if not key:
        return ""
    return _CERT_SYNONYMS.get(key, key.replace(" ", "_") if " " in key else key)


def credential_label(code: str) -> str:
    c = normalize_credential_code(code)
    return CERT_LABELS.get(c, c or code)


@dataclass(frozen=True)
class CertRequirement:
    code: str
    facility_id: Optional[str] = None

    def applies_to_facility(self, facility_id: Optional[str]) -> bool:
        if not self.facility_id:
            return True
        if not facility_id:
            return True
        return str(self.facility_id) == str(facility_id)


def parse_cert_requirements(raw: Any) -> list[CertRequirement]:
    if not raw:
        return []
    items = raw if isinstance(raw, list) else [raw]
    out: list[CertRequirement] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        code = ""
        facility_id: Optional[str] = None
        if isinstance(item, str):
            code = normalize_credential_code(item)
        elif isinstance(item, dict):
            code = normalize_credential_code(
                str(item.get("code") or item.get("name") or item.get("certification") or "")
            )
            fid = item.get("facility_id") or item.get("facilityId") or item.get("zone_id")
            if fid:
                facility_id = str(fid)
        else:
            continue
        if not code:
            continue
        key = (code, facility_id or "")
        if key in seen:
            continue
        seen.add(key)
        out.append(CertRequirement(code=code, facility_id=facility_id))
    return out


def serialize_cert_requirements(reqs: Iterable[CertRequirement]) -> list[Any]:
    out: list[Any] = []
    for r in reqs:
        if r.facility_id:
            out.append({"code": r.code, "facility_id": r.facility_id})
        else:
            out.append(r.code)
    return out


def cert_status_from_expiry(expiry: Optional[datetime], now: Optional[datetime] = None) -> str:
    if expiry is None:
        return "no_expiry"
    current = now or datetime.now(timezone.utc)
    exp = expiry if expiry.tzinfo else expiry.replace(tzinfo=timezone.utc)
    cmp_now = current if current.tzinfo else current.replace(tzinfo=timezone.utc)
    return "expired" if exp < cmp_now else "valid"


@dataclass
class WorkerCredentialState:
    qualified: set[str] = field(default_factory=set)
    expired: set[str] = field(default_factory=set)

    @property
    def held(self) -> set[str]:
        return set(self.qualified) | set(self.expired)


def build_worker_credential_state(
    *,
    legacy_codes: Iterable[str] | None = None,
    certification_records: Iterable[dict[str, Any]] | None = None,
    completed_training: Iterable[str] | None = None,
    now: Optional[datetime] = None,
) -> WorkerCredentialState:
    state = WorkerCredentialState()
    current = now or datetime.now(timezone.utc)

    for rec in certification_records or []:
        code = normalize_credential_code(str(rec.get("name") or rec.get("code") or ""))
        if not code:
            continue
        status = str(rec.get("status") or "").strip().lower()
        expiry = rec.get("expiry_date")
        if status not in {"expired", "valid", "no_expiry"}:
            status = cert_status_from_expiry(expiry if isinstance(expiry, datetime) else None, current)
        if status == "expired":
            state.expired.add(code)
        else:
            state.qualified.add(code)

    for raw in legacy_codes or []:
        code = normalize_credential_code(str(raw))
        if not code:
            continue
        if code in state.expired:
            continue
        state.qualified.add(code)

    for raw in completed_training or []:
        code = normalize_credential_code(str(raw))
        if not code:
            continue
        if code in state.expired:
            continue
        state.qualified.add(code)

    state.qualified -= state.expired
    return state


@dataclass(frozen=True)
class StaffingAlarm:
    code: str
    severity: str
    label: str
    kind: str = "training"

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "severity": self.severity, "label": self.label, "kind": self.kind}


def evaluate_assignment_training(
    required: Iterable[CertRequirement],
    worker: WorkerCredentialState,
    *,
    facility_id: Optional[str] = None,
    accepts_any: bool = False,
) -> list[StaffingAlarm]:
    applicable = [r for r in required if r.applies_to_facility(facility_id)]
    if not applicable:
        return []

    def alarm_for(req: CertRequirement) -> StaffingAlarm:
        label = credential_label(req.code)
        if req.code in worker.expired:
            suffix = f" at this facility" if req.facility_id else ""
            return StaffingAlarm(
                code="training_expired",
                severity="critical",
                label=f"{label} expired{suffix}",
                kind="training",
            )
        suffix = " for this facility" if req.facility_id else ""
        return StaffingAlarm(
            code="training_missing",
            severity="critical",
            label=f"Missing {label}{suffix}",
            kind="training",
        )

    if accepts_any:
        if any(r.code in worker.qualified for r in applicable):
            return []
        expired = [r for r in applicable if r.code in worker.expired]
        if expired:
            return [alarm_for(expired[0])]
        codes = ", ".join(credential_label(r.code) for r in applicable)
        return [
            StaffingAlarm(
                code="training_missing",
                severity="critical",
                label=f"Requires one of: {codes}",
                kind="training",
            )
        ]

    alarms: list[StaffingAlarm] = []
    seen: set[str] = set()
    for req in applicable:
        if req.code in worker.qualified:
            continue
        key = f"{req.code}:{req.facility_id or ''}"
        if key in seen:
            continue
        seen.add(key)
        alarms.append(alarm_for(req))
    return alarms


def applicable_requirement_codes(
    required: Iterable[CertRequirement],
    facility_id: Optional[str],
) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for r in required:
        if not r.applies_to_facility(facility_id):
            continue
        if r.code in seen:
            continue
        seen.add(r.code)
        out.append(r.code)
    return out


async def load_worker_credential_states(
    db: AsyncSession,
    company_id: str,
    user_ids: Iterable[str],
    *,
    now: Optional[datetime] = None,
) -> dict[str, WorkerCredentialState]:
    ids = [str(u) for u in user_ids if u]
    states: dict[str, WorkerCredentialState] = {uid: WorkerCredentialState() for uid in ids}
    if not ids:
        return states
    current = now or datetime.now(timezone.utc)

    pq = await db.execute(
        select(PulseWorkerProfile).where(
            PulseWorkerProfile.company_id == company_id,
            PulseWorkerProfile.user_id.in_(ids),
        )
    )
    profiles = {str(p.user_id): p for p in pq.scalars().all()}

    cq = await db.execute(
        select(PulseWorkerCertification).where(
            PulseWorkerCertification.company_id == company_id,
            PulseWorkerCertification.user_id.in_(ids),
        )
    )
    records_by_user: dict[str, list[dict[str, Any]]] = {uid: [] for uid in ids}
    for row in cq.scalars().all():
        records_by_user.setdefault(str(row.user_id), []).append(
            {
                "name": row.name,
                "expiry_date": row.expiry_date,
                "status": cert_status_from_expiry(row.expiry_date, current),
            }
        )

    tq = await db.execute(
        select(PulseWorkerTraining).where(
            PulseWorkerTraining.company_id == company_id,
            PulseWorkerTraining.user_id.in_(ids),
        )
    )
    training_by_user: dict[str, list[str]] = {uid: [] for uid in ids}
    for row in tq.scalars().all():
        training_by_user.setdefault(str(row.user_id), []).append(row.name)

    for uid in ids:
        prof = profiles.get(uid)
        states[uid] = build_worker_credential_state(
            legacy_codes=list(prof.certifications or []) if prof else [],
            certification_records=records_by_user.get(uid, []),
            completed_training=training_by_user.get(uid, []),
            now=current,
        )
    return states


async def load_shift_definitions_map(
    db: AsyncSession,
    company_id: str,
) -> dict[str, PulseScheduleShiftDefinition]:
    q = await db.execute(
        select(PulseScheduleShiftDefinition).where(PulseScheduleShiftDefinition.company_id == company_id)
    )
    return {str(r.id): r for r in q.scalars().all()}


def certification_records_payload(
    records: Iterable[PulseWorkerCertification],
    *,
    now: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    current = now or datetime.now(timezone.utc)
    out: list[dict[str, Any]] = []
    for row in records:
        out.append(
            {
                "name": row.name,
                "expiry_date": row.expiry_date,
                "status": cert_status_from_expiry(row.expiry_date, current),
            }
        )
    return out


def normalized_cert_requirements_payload(raw: Any) -> list[Any]:
    return serialize_cert_requirements(parse_cert_requirements(raw))


async def load_worker_credential_payloads(
    db: AsyncSession,
    company_id: str,
    user_ids: Iterable[str],
    *,
    now: Optional[datetime] = None,
) -> dict[str, tuple[list[dict[str, Any]], list[str]]]:
    """user_id → (certification_records, completed_training names)."""
    ids = [str(u) for u in user_ids if u]
    current = now or datetime.now(timezone.utc)
    empty: dict[str, tuple[list[dict[str, Any]], list[str]]] = {uid: ([], []) for uid in ids}
    if not ids:
        return empty

    cq = await db.execute(
        select(PulseWorkerCertification).where(
            PulseWorkerCertification.company_id == company_id,
            PulseWorkerCertification.user_id.in_(ids),
        )
    )
    records: dict[str, list[dict[str, Any]]] = {uid: [] for uid in ids}
    for row in cq.scalars().all():
        records.setdefault(str(row.user_id), []).append(
            {
                "name": row.name,
                "expiry_date": row.expiry_date,
                "status": cert_status_from_expiry(row.expiry_date, current),
            }
        )

    tq = await db.execute(
        select(PulseWorkerTraining).where(
            PulseWorkerTraining.company_id == company_id,
            PulseWorkerTraining.user_id.in_(ids),
        )
    )
    training: dict[str, list[str]] = {uid: [] for uid in ids}
    for row in tq.scalars().all():
        training.setdefault(str(row.user_id), []).append(row.name)

    return {uid: (records.get(uid, []), training.get(uid, [])) for uid in ids}


def apply_training_fields_to_shift_out(
    out: Any,
    *,
    definition: PulseScheduleShiftDefinition | None,
    worker_state: WorkerCredentialState | None,
) -> Any:
    """Attach required_certifications + staffing_alarms onto a ShiftOut-like object."""
    reqs = parse_cert_requirements(getattr(definition, "cert_requirements", None) if definition else None)
    facility_id = getattr(out, "facility_id", None)
    codes = applicable_requirement_codes(reqs, facility_id)
    alarms = (
        evaluate_assignment_training(reqs, worker_state, facility_id=facility_id)
        if worker_state is not None
        else []
    )
    updates = {
        "required_certifications": codes,
        "staffing_alarms": [a.as_dict() for a in alarms],
    }
    if hasattr(out, "model_copy"):
        return out.model_copy(update=updates)
    for k, v in updates.items():
        setattr(out, k, v)
    return out


async def enrich_shift_outs(
    db: AsyncSession,
    company_id: str,
    shifts: Iterable[Any],
    outs: list[Any],
) -> list[Any]:
    rows = list(shifts)
    if not outs:
        return outs
    defn_map = await load_shift_definitions_map(db, company_id)
    code_map = {
        str(d.code or "").strip().upper(): d for d in defn_map.values() if str(d.code or "").strip()
    }
    user_ids = [str(getattr(r, "assigned_user_id", "") or "") for r in rows]
    states = await load_worker_credential_states(db, company_id, user_ids)
    enriched: list[Any] = []
    for row, out in zip(rows, outs):
        defn_id = getattr(row, "shift_definition_id", None)
        defn = defn_map.get(str(defn_id)) if defn_id else None
        if defn is None:
            code = str(getattr(row, "shift_code", "") or "").strip().upper()
            if code:
                defn = code_map.get(code)
        uid = str(getattr(row, "assigned_user_id", "") or "")
        enriched.append(
            apply_training_fields_to_shift_out(out, definition=defn, worker_state=states.get(uid))
        )
    return enriched
