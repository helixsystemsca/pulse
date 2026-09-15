"""GET /recreation-ops/regulations — Codes & Guidance list + links under FORCE RLS."""

from __future__ import annotations

import re
import uuid
from contextlib import asynccontextmanager
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.core.features.cache import clear_all
from app.core.security.tenant_rls import apply_pulse_rls_context
from app.models.domain import User, UserRole
from app.models.ops_foundation_models import OpsEntityLink, OpsFacility, OpsRegulation
from app.services import ops_foundation_service as svc


@asynccontextmanager
async def _pulse_app_style_role(db_session: AsyncSession):
    """Temporary NOBYPASSRLS role — same pattern as login / feature-gate FORCE RLS tests."""
    role = "pulse_reg_" + uuid.uuid4().hex[:10]
    assert re.fullmatch(r"pulse_reg_[0-9a-f]+", role)
    await db_session.execute(text(f"CREATE ROLE {role} NOLOGIN NOBYPASSRLS NOSUPERUSER"))
    try:
        await db_session.execute(text(f"GRANT USAGE ON SCHEMA public TO {role}"))
        await db_session.execute(
            text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role}")
        )
        await db_session.execute(text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}"))
        await db_session.execute(text(f"GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO {role}"))
        await db_session.execute(text(f"SET ROLE {role}"))
        try:
            yield role
        finally:
            await db_session.execute(text("RESET ROLE"))
    finally:
        await db_session.execute(text("RESET ROLE"))
        await db_session.execute(text(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM {role}"))
        await db_session.execute(text(f"REVOKE ALL ON SCHEMA public FROM {role}"))
        await db_session.execute(text(f"DROP ROLE IF EXISTS {role}"))


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


def _card(*, company_id: str, title: str, classification: str, category: str) -> OpsRegulation:
    return OpsRegulation(
        id=str(uuid.uuid4()),
        company_id=company_id,
        title=title,
        status="active",
        tags=["regulatory-reference"],
        authority="Technical Safety BC",
        regulation_name=title,
        summary="Reference pointer only.",
        topic_category=category,
        classification=classification,
        official_source_name="Technical Safety BC",
        official_source_url="https://www.technicalsafetybc.ca/",
        verification_status="Reviewed",
        review_date=date(2026, 9, 15),
        pulse_pointers=[{"label": "Emergency hub", "href": "/recreation/emergency"}],
    )


@pytest.mark.asyncio
async def test_list_regulations_hydrates_links_and_classifications(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
) -> None:
    """N+1 list_links_for (the production 500) must not raise DuplicatePreparedStatement."""
    token = await _admin_token(db_session, seeded_tenant)
    cid = seeded_tenant.company_id
    cards = [
        _card(company_id=cid, title="Chief engineer plant", classification="Regulator guidance", category="Chief Engineer"),
        _card(company_id=cid, title="WorkSafeBC ammonia", classification="Law/Regulation", category="OH&S"),
        _card(company_id=cid, title="BC Building Code", classification="Law/Regulation", category="Building Code"),
        _card(company_id=cid, title="Interior Health pools", classification="Regulator guidance", category="Interior Health / Pools"),
        _card(company_id=cid, title="Pool Regulation", classification="Law/Regulation", category="Interior Health / Pools"),
        _card(company_id=cid, title="CSA Z614 playground", classification="Industry standard", category="Playground"),
        _card(company_id=cid, title="Fire Services Bylaw", classification="Municipal policy", category="Fire"),
        _card(company_id=cid, title="WHMIS chemicals", classification="Law/Regulation", category="Chemicals"),
    ]
    facility = OpsFacility(
        id=str(uuid.uuid4()),
        company_id=cid,
        title="Vernon Civic Arena",
        status="active",
        tags=["vernon-starter"],
    )
    db_session.add_all([*cards, facility])
    await db_session.flush()
    db_session.add(
        OpsEntityLink(
            id=str(uuid.uuid4()),
            company_id=cid,
            from_type="regulations",
            from_id=cards[0].id,
            to_type="facilities",
            to_id=facility.id,
            link_role="applies-to",
        )
    )
    await db_session.flush()

    async with _pulse_app_style_role(db_session):
        await apply_pulse_rls_context(db_session, company_id=cid, is_system_admin=False)
        r = await client.get(
            "/api/v1/recreation-ops/regulations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body) == 8
        by_title = {row["title"]: row for row in body}
        assert by_title["Chief engineer plant"]["classification"] == "Regulator guidance"
        assert by_title["BC Building Code"]["classification"] == "Law/Regulation"
        assert by_title["CSA Z614 playground"]["classification"] == "Industry standard"
        assert by_title["Fire Services Bylaw"]["classification"] == "Municipal policy"
        assert by_title["Chief engineer plant"]["topic_category"] == "Chief Engineer"
        links = by_title["Chief engineer plant"]["links"]
        assert len(links) == 1
        assert links[0]["to_type"] == "facilities"
        assert links[0]["to_id"] == facility.id
        assert links[0]["link_role"] == "applies-to"
        assert by_title["Pool Regulation"]["links"] == []


@pytest.mark.asyncio
async def test_list_links_for_keeps_tenant_filter_under_force_rls(
    db_session: AsyncSession, seeded_tenant
) -> None:
    """Engine fix must not drop company_id filters used by FORCE RLS policies."""
    other_company = str(uuid.uuid4())
    from app.models.domain import Company

    db_session.add(Company(id=other_company, name="Other Co", theme={}))
    await db_session.flush()

    ours = _card(
        company_id=seeded_tenant.company_id,
        title="Ours",
        classification="Law/Regulation",
        category="OH&S",
    )
    theirs = _card(
        company_id=other_company,
        title="Theirs",
        classification="Law/Regulation",
        category="OH&S",
    )
    db_session.add_all([ours, theirs])
    await db_session.flush()
    db_session.add(
        OpsEntityLink(
            id=str(uuid.uuid4()),
            company_id=other_company,
            from_type="regulations",
            from_id=theirs.id,
            to_type="regulations",
            to_id=theirs.id,
            link_role="self",
        )
    )
    await db_session.flush()

    async with _pulse_app_style_role(db_session):
        await apply_pulse_rls_context(
            db_session, company_id=seeded_tenant.company_id, is_system_admin=False
        )
        links = await svc.list_links_for(
            db_session, seeded_tenant.company_id, "regulations", ours.id
        )
        assert links == []
        leaked = await svc.list_links_for(db_session, other_company, "regulations", theirs.id)
        assert leaked == []
        ours_rows = await svc.list_records(db_session, seeded_tenant.company_id, "regulations")
        assert [row.title for row in ours_rows] == ["Ours"]
