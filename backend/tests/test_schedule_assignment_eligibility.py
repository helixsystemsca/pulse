"""Unit tests for schedule training / certification eligibility (no HTTP)."""

from datetime import datetime, timedelta, timezone

from types import SimpleNamespace

from app.services.schedule_assignment_eligibility import (
    apply_training_fields_to_shift_out,
    build_worker_credential_state,
    cert_requirements_accepts_any,
    evaluate_assignment_training,
    normalize_credential_code,
    parse_cert_requirements,
    staffing_alarm_label,
)


def test_normalize_synonyms_and_codes() -> None:
    assert normalize_credential_code("pool operator level 1") == "P1"
    assert normalize_credential_code("FA") == "FA"
    assert normalize_credential_code("  first aid ") == "FA"
    assert normalize_credential_code("national lifeguard") == "NLS"
    assert normalize_credential_code("NLS") == "NLS"
    assert normalize_credential_code("Lifeguard") == "NLS"


def test_parse_mixed_requirement_shapes() -> None:
    reqs = parse_cert_requirements(
        ["P1", {"code": "FA", "facility_id": "fac-1"}, {"name": "Pool Operator Level 2"}]
    )
    assert [r.code for r in reqs] == ["P1", "FA", "P2"]
    assert reqs[1].facility_id == "fac-1"


def test_missing_required_training_is_critical_alarm() -> None:
    worker = build_worker_credential_state(legacy_codes=["FA"])
    reqs = parse_cert_requirements(["P1", "FA"])
    alarms = evaluate_assignment_training(reqs, worker)
    assert len(alarms) == 1
    assert alarms[0].code == "training_missing"
    assert alarms[0].severity == "critical"
    assert "Pool Operator Level 1" in alarms[0].label


def test_expired_cert_is_not_treated_as_qualified() -> None:
    past = datetime.now(timezone.utc) - timedelta(days=2)
    worker = build_worker_credential_state(
        legacy_codes=["P1"],
        certification_records=[{"name": "P1", "expiry_date": past, "status": "expired"}],
    )
    assert "P1" in worker.expired
    assert "P1" not in worker.qualified
    alarms = evaluate_assignment_training(parse_cert_requirements(["P1"]), worker)
    assert alarms[0].code == "training_expired"
    assert "expired" in alarms[0].label.lower()


def test_completed_training_satisfies_requirement() -> None:
    worker = build_worker_credential_state(completed_training=["Pool Operator Level 1"])
    alarms = evaluate_assignment_training(parse_cert_requirements(["P1"]), worker)
    assert alarms == []


def test_facility_scoped_requirement_only_applies_at_that_facility() -> None:
    worker = build_worker_credential_state()
    reqs = parse_cert_requirements([{"code": "P1", "facility_id": "pool"}])
    other = evaluate_assignment_training(reqs, worker, facility_id="arena")
    here = evaluate_assignment_training(reqs, worker, facility_id="pool")
    assert other == []
    assert len(here) == 1
    assert here[0].code == "training_missing"
    assert "facility" in here[0].label.lower()


def test_accepts_any_passes_when_one_code_is_qualified() -> None:
    worker = build_worker_credential_state(legacy_codes=["P2"])
    reqs = parse_cert_requirements(["P1", "P2"])
    assert evaluate_assignment_training(reqs, worker, accepts_any=True) == []
    empty = build_worker_credential_state()
    alarms = evaluate_assignment_training(reqs, empty, accepts_any=True)
    assert alarms[0].code == "training_missing"
    assert "one of" in alarms[0].label.lower()


def test_staffing_alarm_label_accepts_dict_or_object() -> None:
    assert staffing_alarm_label({"label": "Missing P1"}) == "Missing P1"
    assert staffing_alarm_label(SimpleNamespace(label="FA expired")) == "FA expired"
    assert staffing_alarm_label({}) == ""


def test_any_of_requirements_are_or_not_and() -> None:
    raw = [{"any_of": ["P1", "NLS"]}]
    assert cert_requirements_accepts_any(raw) is True
    reqs = parse_cert_requirements(raw)
    worker = build_worker_credential_state(legacy_codes=["NLS"])
    assert evaluate_assignment_training(reqs, worker, accepts_any=True) == []


def test_enrich_preserves_facility_scoped_shape() -> None:
    definition = SimpleNamespace(cert_requirements=[{"code": "P1", "facility_id": "pool"}])
    out = SimpleNamespace(facility_id="pool", accepts_any_certification=False)
    worker = build_worker_credential_state()
    enriched = apply_training_fields_to_shift_out(out, definition=definition, worker_state=worker)
    assert enriched.accepts_any_certification is False
    assert enriched.required_certifications == [{"code": "P1", "facility_id": "pool"}]
    assert len(enriched.staffing_alarms) == 1


def test_enrich_evaluates_accepts_any_from_definition() -> None:
    definition = SimpleNamespace(cert_requirements=[{"any_of": ["P1", "NLS"]}])
    out = SimpleNamespace(facility_id="pool", accepts_any_certification=False)
    worker = build_worker_credential_state(legacy_codes=["NLS"])
    enriched = apply_training_fields_to_shift_out(out, definition=definition, worker_state=worker)
    assert enriched.accepts_any_certification is True
    assert enriched.staffing_alarms == []
    assert "P1" in enriched.required_certifications
    assert "NLS" in enriched.required_certifications
