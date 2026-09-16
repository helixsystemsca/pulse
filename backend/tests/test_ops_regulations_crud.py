"""Codes & Guidance create/update + Vernon seed must not clobber Josh's edits."""

from __future__ import annotations

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.core.features.cache import clear_all
from app.core.regulatory_reference_catalog import REFERENCE_CARDS, seed_tag_for
from app.core.vernon_starter_seed import seed_regulatory_reference_cards
from app.models.domain import User, UserRole
from app.models.ops_foundation_models import OpsRegulation


async def _admin_token(db_session: AsyncSession, seeded_tenant) -> str:
    from app.core.company_features import sync_enabled_features
    from app.core.features.system_catalog import GLOBAL_SYSTEM_FEATURES

    await sync_enabled_features(db_session, seeded_tenant.company_id, list(GLOBAL_SYSTEM_FEATURES))
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    clear_all()
    return create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.mark.asyncio
async def test_create_and_patch_regulation_persists(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    created = await client.post(
        "/api/v1/recreation-ops/regulations",
        headers=_headers(token),
        json={
            "title": "Josh arena attendance memo",
            "summary": "Internal reminder to walk the plant at the start of ice.",
            "description": "Internal reminder to walk the plant at the start of ice.",
            "topic_category": "Chief Engineer",
            "classification": "Internal note",
            "verification_status": "Unverified",
            "applicability": "Vernon Civic Arena ice plant",
            "authority": "City of Vernon recreation",
            "official_source_name": "Internal ops note",
            "official_source_url": None,
            "pulse_pointers": [{"label": "Emergency hub", "href": "/recreation/emergency"}],
            "tags": ["regulatory-reference", "ice plant"],
            "status": "active",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    rid = body["id"]
    assert body["title"] == "Josh arena attendance memo"
    assert body["classification"] == "Internal note"
    assert body["user_modified"] is True
    assert body.get("source_key") in (None, "")
    assert body["pulse_pointers"] == [{"label": "Emergency hub", "href": "/recreation/emergency"}]

    patched = await client.patch(
        f"/api/v1/recreation-ops/regulations/{rid}",
        headers=_headers(token),
        json={
            "title": "Josh arena attendance memo (updated)",
            "summary": "Walk the plant before public skate. Internal note, not a regulation.",
            "classification": "Best practice",
            "review_date": "2026-10-01",
            "pulse_pointers": [
                {"label": "Emergency hub", "href": "/recreation/emergency"},
                {"label": "Ice plant PMs", "href": "/equipment"},
            ],
        },
    )
    assert patched.status_code == 200, patched.text
    out = patched.json()
    assert out["title"] == "Josh arena attendance memo (updated)"
    assert out["summary"].startswith("Walk the plant")
    assert out["classification"] == "Best practice"
    assert out["review_date"] == "2026-10-01"
    assert len(out["pulse_pointers"]) == 2

    listed = await client.get(
        "/api/v1/recreation-ops/regulations",
        headers=_headers(token),
        params={"q": "attendance memo"},
    )
    assert listed.status_code == 200, listed.text
    titles = [row["title"] for row in listed.json()]
    assert "Josh arena attendance memo (updated)" in titles


@pytest.mark.asyncio
async def test_seed_does_not_clobber_edited_or_archived_cards(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid = seeded_tenant.company_id
    await seed_regulatory_reference_cards(db_session, cid)

    catalog_key = "chief-engineer-plant-responsibility"
    catalog_title = next(c["title"] for c in REFERENCE_CARDS if c["key"] == catalog_key)
    row = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == catalog_key)
        )
    ).scalar_one()
    assert row.title == catalog_title
    row.summary = "Josh's site-specific notes about the Vernon ice plant."
    row.title = "Chief engineer — Vernon ice plant (Josh)"
    row.user_modified = True
    await db_session.flush()

    untouched_key = "bc-building-code-how-it-applies"
    untouched_title = next(c["title"] for c in REFERENCE_CARDS if c["key"] == untouched_key)
    other = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == untouched_key)
        )
    ).scalar_one()
    other.title = "Temporary title that seed may restore"
    other.user_modified = False
    await db_session.flush()

    archived_key = "playground-csa-z614"
    archived = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == archived_key)
        )
    ).scalar_one()
    archived.status = "archived"
    archived.summary = "Archived on purpose"
    archived.user_modified = True
    await db_session.flush()

    before = (
        await db_session.execute(
            select(func.count()).select_from(OpsRegulation).where(OpsRegulation.company_id == cid)
        )
    ).scalar_one()

    await seed_regulatory_reference_cards(db_session, cid)

    await db_session.refresh(row)
    assert row.title == "Chief engineer — Vernon ice plant (Josh)"
    assert row.summary == "Josh's site-specific notes about the Vernon ice plant."
    assert row.user_modified is True
    assert seed_tag_for(catalog_key) in (row.tags or [])

    await db_session.refresh(other)
    assert other.title == untouched_title
    assert other.user_modified is False

    await db_session.refresh(archived)
    assert archived.status == "archived"
    assert archived.summary == "Archived on purpose"

    after = (
        await db_session.execute(
            select(func.count()).select_from(OpsRegulation).where(OpsRegulation.company_id == cid)
        )
    ).scalar_one()
    assert after == before == len(REFERENCE_CARDS)


@pytest.mark.asyncio
async def test_seed_inserts_missing_catalog_key_without_clobbering_edits(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid = seeded_tenant.company_id
    await seed_regulatory_reference_cards(db_session, cid)

    new_key = "tsbc-ammonia-safety-awareness"
    catalog_summary = next(c["summary"] for c in REFERENCE_CARDS if c["key"] == new_key)
    row = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == new_key)
        )
    ).scalar_one()
    await db_session.delete(row)
    await db_session.flush()

    edited_key = "chief-engineer-plant-responsibility"
    edited = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == edited_key)
        )
    ).scalar_one()
    edited.summary = "Josh site notes — do not overwrite."
    edited.user_modified = True
    await db_session.flush()

    await seed_regulatory_reference_cards(db_session, cid)

    restored = (
        await db_session.execute(
            select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.source_key == new_key)
        )
    ).scalar_one()
    assert restored.summary == catalog_summary
    assert restored.user_modified is False
    assert seed_tag_for(new_key) in (restored.tags or [])

    await db_session.refresh(edited)
    assert edited.summary == "Josh site notes — do not overwrite."
    assert edited.user_modified is True

    count = (
        await db_session.execute(
            select(func.count()).select_from(OpsRegulation).where(OpsRegulation.company_id == cid)
        )
    ).scalar_one()
    assert count == len(REFERENCE_CARDS)


@pytest.mark.asyncio
async def test_seed_does_not_steal_user_created_title_collision(
    db_session: AsyncSession, seeded_tenant
) -> None:
    cid = seeded_tenant.company_id
    catalog = REFERENCE_CARDS[0]
    db_session.add(
        OpsRegulation(
            company_id=cid,
            title=catalog["title"],
            summary="Josh wrote this first.",
            topic_category="Other",
            classification="Internal note",
            status="active",
            tags=["regulatory-reference"],
            user_modified=True,
            source_key=None,
            review_date=date(2026, 9, 15),
        )
    )
    await db_session.flush()

    await seed_regulatory_reference_cards(db_session, cid)

    rows = list(
        (
            await db_session.execute(
                select(OpsRegulation).where(OpsRegulation.company_id == cid, OpsRegulation.title == catalog["title"])
            )
        ).scalars().all()
    )
    assert len(rows) == 2
    josh = next(r for r in rows if r.user_modified and not r.source_key)
    seeded = next(r for r in rows if r.source_key == catalog["key"])
    assert josh.summary == "Josh wrote this first."
    assert seeded.summary == catalog["summary"]


@pytest.mark.asyncio
async def test_unauthenticated_cannot_patch_regulation(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    token = await _admin_token(db_session, seeded_tenant)
    created = await client.post(
        "/api/v1/recreation-ops/regulations",
        headers=_headers(token),
        json={"title": "Restricted card", "summary": "admin only", "status": "active"},
    )
    assert created.status_code == 201, created.text
    rid = created.json()["id"]

    anon = await client.patch(
        f"/api/v1/recreation-ops/regulations/{rid}",
        json={"title": "Hacked title"},
    )
    assert anon.status_code == 401
    row = await db_session.get(OpsRegulation, rid)
    assert row is not None
    assert row.title == "Restricted card"
