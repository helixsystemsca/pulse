"""Training platform courses, progress, and spaced-repetition study."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers

_SAMPLE_PACK = {
    "version": "1.0",
    "source_name": "phase2-test-pack",
    "courses": [
        {
            "slug": "safety-basics",
            "title": "Safety Basics",
            "description": "Intro safety course",
            "course_kind": "safety",
            "sections": [
                {
                    "slug": "intro",
                    "title": "Introduction",
                    "lessons": [
                        {
                            "slug": "ppe",
                            "title": "PPE overview",
                            "content_markdown": "## Wear your PPE\nAlways use required equipment.",
                            "flashcards": [
                                {
                                    "prompt": "What does PPE stand for?",
                                    "answer": "Personal protective equipment",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    ],
}


@pytest.mark.asyncio
async def test_training_platform_import_list_course_progress_study(client, seeded_tenant) -> None:
    mgr_headers = auth_headers(seeded_tenant.manager_token)
    worker_headers = auth_headers(seeded_tenant.worker_token)

    imp = await client.post("/api/v1/training/import", headers=mgr_headers, json=_SAMPLE_PACK)
    assert imp.status_code == 201, imp.text
    body = imp.json()
    assert body["status"] == "completed"
    assert body["created"]["courses"] == 1
    assert body["created"]["flashcards"] >= 1

    courses = await client.get("/api/v1/training/courses", headers=worker_headers)
    assert courses.status_code == 200, courses.text
    body = courses.json()
    assert len(body) >= 1
    course = next(c for c in body if c["slug"] == "safety-basics")
    course_id = course["id"]

    detail = await client.get(f"/api/v1/training/courses/{course_id}", headers=worker_headers)
    assert detail.status_code == 200, detail.text
    lesson_id = detail.json()["sections"][0]["lessons"][0]["id"]

    lesson = await client.get(
        f"/api/v1/training/courses/{course_id}/lessons/{lesson_id}",
        headers=worker_headers,
    )
    assert lesson.status_code == 200, lesson.text
    assert "PPE" in (lesson.json().get("content_markdown") or "")

    prog = await client.post(
        "/api/v1/training/progress",
        headers=worker_headers,
        json={
            "scope_kind": "lesson",
            "scope_id": lesson_id,
            "status": "completed",
            "progress_pct": 100,
        },
    )
    assert prog.status_code == 200, prog.text
    assert prog.json()["status"] == "completed"

    courses_after = await client.get("/api/v1/training/courses", headers=worker_headers)
    updated = next(c for c in courses_after.json() if c["id"] == course_id)
    assert updated["progress_pct"] == 100
    assert updated["progress_status"] == "completed"

    due = await client.get("/api/v1/training/study/due", headers=worker_headers)
    assert due.status_code == 200, due.text
    due_body = due.json()
    assert due_body["due_count"] >= 1
    card_id = due_body["cards"][0]["flashcard"]["id"]

    review = await client.post(
        f"/api/v1/training/study/review/{card_id}",
        headers=worker_headers,
        json={"rating": "good"},
    )
    assert review.status_code == 200, review.text
    assert review.json()["interval_days"] >= 1

    dash = await client.get("/api/v1/training/dashboard", headers=worker_headers)
    assert dash.status_code == 200, dash.text

    paths = await client.get("/api/v1/training/learning-paths", headers=worker_headers)
    assert paths.status_code == 200, paths.text
    assert paths.json() == []


_CAPM_SECTION_PACK = {
    "version": "1.0",
    "source_name": "capm-upsert-test",
    "courses": [
        {
            "slug": "capm",
            "title": "CAPM Prep",
            "sections": [
                {
                    "slug": "integration",
                    "title": "Integration",
                    "flashcards": [
                        {
                            "id": "capm-int-001",
                            "prompt": "Define a project.",
                            "answer": "A temporary endeavor undertaken to create a unique product, service, or result.",
                        }
                    ],
                }
            ],
        }
    ],
}


@pytest.mark.asyncio
async def test_training_import_upsert_and_validation(client, seeded_tenant) -> None:
    mgr_headers = auth_headers(seeded_tenant.manager_token)

    first = await client.post("/api/v1/training/import", headers=mgr_headers, json=_CAPM_SECTION_PACK)
    assert first.status_code == 201, first.text
    first_body = first.json()
    assert first_body["created"]["courses"] == 1
    assert first_body["created"]["flashcards"] == 1

    updated_pack = {
        **_CAPM_SECTION_PACK,
        "courses": [
            {
                **_CAPM_SECTION_PACK["courses"][0],
                "title": "CAPM Prep (rev 2)",
                "sections": [
                    {
                        **_CAPM_SECTION_PACK["courses"][0]["sections"][0],
                        "flashcards": [
                            {
                                "id": "capm-int-001",
                                "prompt": "Define a project.",
                                "answer": "Temporary endeavor with a unique outcome.",
                            }
                        ],
                    }
                ],
            }
        ],
    }
    second = await client.post("/api/v1/training/import", headers=mgr_headers, json=updated_pack)
    assert second.status_code == 201, second.text
    second_body = second.json()
    assert second_body["updated"]["courses"] == 1
    assert second_body["updated"]["flashcards"] == 1
    assert second_body["created"]["flashcards"] == 0

    bad = await client.post(
        "/api/v1/training/import",
        headers=mgr_headers,
        content=b"{not-json",
    )
    assert bad.status_code == 400, bad.text
    assert bad.json()["status"] == "failed_validation"
    assert any(e["code"] == "invalid_json" for e in bad.json()["errors"])

    dup = await client.post(
        "/api/v1/training/import",
        headers=mgr_headers,
        json={
            "version": "1.0",
            "source_name": "dup-test",
            "courses": [
                {
                    "slug": "x",
                    "title": "X",
                    "sections": [
                        {
                            "slug": "s1",
                            "title": "S1",
                            "flashcards": [
                                {"id": "a", "prompt": "Q1", "answer": "A1"},
                                {"id": "a", "prompt": "Q2", "answer": "A2"},
                            ],
                        }
                    ],
                }
            ],
        },
    )
    assert dup.status_code == 400, dup.text
    assert any(e["code"] == "duplicate_id" for e in dup.json()["errors"])
