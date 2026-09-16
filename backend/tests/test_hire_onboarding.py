"""Hire-time onboarding packets: progress math, plant conditions, API summary."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.domain import User
from app.services.hire_onboarding.service import is_plant_role, packet_progress
from tests.conftest import auth_headers


def _item(*, required: bool = True, status: str = "pending") -> SimpleNamespace:
    return SimpleNamespace(is_required=required, status=status)


def test_packet_progress_empty() -> None:
    result = packet_progress([])
    assert result["required_total"] == 0
    assert result["required_completed"] == 0
    assert result["percent"] == 0
    assert result["status"] == "open"


def test_packet_progress_ignores_optional_items() -> None:
    items = [
        _item(required=True, status="completed"),
        _item(required=True, status="pending"),
        _item(required=False, status="pending"),
    ]
    result = packet_progress(items)
    assert result["required_total"] == 2
    assert result["required_completed"] == 1
    assert result["percent"] == 50
    assert result["status"] == "open"


def test_packet_progress_complete_when_all_required_done() -> None:
    items = [
        _item(required=True, status="completed"),
        _item(required=True, status="completed"),
        _item(required=False, status="pending"),
    ]
    result = packet_progress(items)
    assert result["percent"] == 100
    assert result["status"] == "completed"


def test_packet_progress_rounds_percent() -> None:
    items = [_item(status="completed"), _item(), _item()]
    assert packet_progress(items)["percent"] == 33


def test_is_plant_role_from_department_and_title() -> None:
    assert is_plant_role(department="plant") is True
    assert is_plant_role(job_title="Chief Engineer") is True
    assert is_plant_role(department="aquatics", job_title="Lifeguard") is False
    assert is_plant_role(department_slugs=["arena", "admin"]) is True


async def _enable_team_management(db, user_id: str) -> None:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    user.feature_allow_extra = ["team_management"]
    await db.flush()


@pytest.mark.asyncio
async def test_hire_onboarding_template_seeds_and_is_editable(client, seeded_tenant, db_session) -> None:
    await _enable_team_management(db_session, seeded_tenant.manager_id)
    headers = auth_headers(seeded_tenant.manager_token)

    seeded = await client.get("/api/workers/hire-onboarding/template", headers=headers)
    assert seeded.status_code == 200, seeded.text
    body = seeded.json()
    keys = [item["key"] for item in body["items"]]
    assert "emergency_contact" in keys
    assert "whmis_ohs" in keys
    assert "ammonia_machinery" in keys
    assert any(item["kind"] == "sign" for item in body["items"])

    edited = await client.put(
        "/api/workers/hire-onboarding/template",
        headers=headers,
        json={
            "name": "Vernon hire packet",
            "items": [
                {
                    "key": "emergency_contact",
                    "title": "Emergency contact",
                    "kind": "review",
                    "applies_when": "always",
                    "is_required": True,
                    "body_text": "Keep a current emergency contact on file.",
                },
                {
                    "key": "code_of_conduct",
                    "title": "Code of conduct",
                    "kind": "sign",
                    "applies_when": "always",
                    "is_required": True,
                },
            ],
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["name"] == "Vernon hire packet"
    assert [i["key"] for i in edited.json()["items"]] == ["emergency_contact", "code_of_conduct"]

    again = await client.get("/api/workers/hire-onboarding/template", headers=headers)
    assert [i["key"] for i in again.json()["items"]] == ["emergency_contact", "code_of_conduct"]


@pytest.mark.asyncio
async def test_hire_onboarding_progress_and_incomplete_summary(client, seeded_tenant, db_session) -> None:
    await _enable_team_management(db_session, seeded_tenant.manager_id)
    headers = auth_headers(seeded_tenant.manager_token)

    created = await client.post(
        f"/api/workers/{seeded_tenant.worker_id}/hire-onboarding",
        headers=headers,
    )
    assert created.status_code == 200, created.text
    packet = created.json()
    assert packet["user_id"] == seeded_tenant.worker_id
    assert packet["progress"]["required_total"] >= 7
    assert packet["progress"]["required_completed"] == 0
    assert packet["progress"]["percent"] == 0
    assert packet["status"] == "open"
    assert "ammonia_machinery" not in {i["item_key"] for i in packet["items"]}

    summary = await client.get("/api/workers/hire-onboarding/incomplete-summary", headers=headers)
    assert summary.status_code == 200, summary.text
    payload = summary.json()
    assert payload["open_hires"] == 1
    assert payload["incomplete_required_items"] == packet["progress"]["required_total"]
    assert payload["hires"][0]["user_id"] == seeded_tenant.worker_id

    review = next(i for i in packet["items"] if i["kind"] == "review")
    signed = next(i for i in packet["items"] if i["kind"] == "sign")

    bad_sign = await client.post(
        f"/api/workers/{seeded_tenant.worker_id}/hire-onboarding/items/{signed['id']}/complete",
        headers=headers,
        json={"signed_ack": True, "signature_name": "  "},
    )
    assert bad_sign.status_code == 400, bad_sign.text

    reviewed = await client.post(
        f"/api/workers/{seeded_tenant.worker_id}/hire-onboarding/items/{review['id']}/complete",
        headers=headers,
        json={},
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["progress"]["required_completed"] == 1
    total = reviewed.json()["progress"]["required_total"]
    assert reviewed.json()["progress"]["percent"] == int(round(100 * 1 / total))

    signed_ok = await client.post(
        f"/api/workers/{seeded_tenant.worker_id}/hire-onboarding/items/{signed['id']}/complete",
        headers=headers,
        json={"signed_ack": True, "signature_name": "Pytest Worker"},
    )
    assert signed_ok.status_code == 200, signed_ok.text
    signed_item = next(i for i in signed_ok.json()["items"] if i["id"] == signed["id"])
    assert signed_item["status"] == "completed"
    assert signed_item["signature_name"] == "Pytest Worker"
    assert signed_ok.json()["progress"]["required_completed"] == 2

    after = await client.get("/api/workers/hire-onboarding/incomplete-summary", headers=headers)
    assert after.json()["incomplete_required_items"] == total - 2


@pytest.mark.asyncio
async def test_create_worker_attaches_hire_packet_and_plant_items(client, seeded_tenant, db_session) -> None:
    await _enable_team_management(db_session, seeded_tenant.manager_id)
    headers = auth_headers(seeded_tenant.manager_token)

    res = await client.post(
        "/api/workers",
        headers=headers,
        json={
            "email": "hire.plant@example.com",
            "full_name": "Plant Hire",
            "role": "worker",
            "department": "maintenance",
            "role_key": "operations",
            "job_title": "Ice plant operator",
            "send_email": False,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["hire_onboarding"] is not None
    assert body["hire_onboarding"]["required_total"] >= 8
    user_id = body["worker"]["id"]

    packet = await client.get(f"/api/workers/{user_id}/hire-onboarding", headers=headers)
    assert packet.status_code == 200, packet.text
    keys = {i["item_key"] for i in packet.json()["items"]}
    assert "ammonia_machinery" in keys
    assert "whmis_ohs" in keys

    summary = await client.get("/api/workers/hire-onboarding/incomplete-summary", headers=headers)
    assert summary.status_code == 200
    ids = {h["user_id"] for h in summary.json()["hires"]}
    assert user_id in ids


@pytest.mark.asyncio
async def test_hire_onboarding_routes_are_not_user_id_capture(client, seeded_tenant, db_session) -> None:
    await _enable_team_management(db_session, seeded_tenant.manager_id)
    res = await client.get(
        "/api/workers/hire-onboarding/incomplete-summary",
        headers=auth_headers(seeded_tenant.manager_token),
    )
    assert res.status_code != 500, res.text
    assert "invalid uuid" not in res.text.lower()
    assert res.status_code == 200, res.text
