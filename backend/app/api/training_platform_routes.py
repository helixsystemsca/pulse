"""Training platform API — courses, study, paths, progress (`/api/v1/training/*`)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_manager_or_above, require_tenant_user
from app.core.user_roles import user_has_any_role
from app.models.domain import User, UserRole
from app.schemas.training_platform import (
    TrainingCourseFlashcardsOut,
    TrainingCourseOut,
    TrainingCourseSummaryOut,
    TrainingDashboardOut,
    TrainingDeckDuplicateIn,
    TrainingDeckRenameIn,
    TrainingDeckSummaryOut,
    TrainingDeckValidationReportOut,
    TrainingFlashcardReviewSubmit,
    TrainingImportResultOut,
    TrainingLearningPathOut,
    TrainingLessonOut,
    TrainingProgressUpsertIn,
    TrainingSm2StateOut,
    TrainingStudyDueOut,
    TrainingStudyStatisticsOut,
    TrainingUserProgressOut,
)
from app.services.training_platform.course_service import get_course_detail, get_lesson_detail, list_published_courses
from app.services.training_platform.deck_validator import validate_deck_pack
from app.services.training_platform.deck_validator_serializers import deck_validation_report_out
from app.services.training_platform.deck_service import (
    archive_deck,
    duplicate_deck,
    export_deck_pack,
    list_training_decks,
    rename_deck,
)
from app.services.training_platform.import_service import TrainingImportService, validation_failure_result
from app.services.training_platform.import_validation import (
    TrainingImportValidationError,
    parse_import_pack_json,
)
from app.services.training_platform.path_service import get_path_detail, list_published_paths
from app.services.training_platform.progress_service import list_user_course_progress, upsert_progress
from app.services.training_platform.study_service import (
    count_due_flashcards,
    list_course_flashcards,
    list_due_flashcards,
    submit_flashcard_review,
)
from app.services.training_platform.study_statistics_service import get_course_study_statistics

router = APIRouter(prefix="/training", tags=["training-platform"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _company_id(user: Annotated[User, Depends(require_tenant_user)]) -> str:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company context required")
    return str(user.company_id)


CompanyId = Annotated[str, Depends(_company_id)]


async def _user_id(user: Annotated[User, Depends(require_tenant_user)]) -> str:
    return str(user.id)


Uid = Annotated[str, Depends(_user_id)]


def _can_view_drafts(user: User) -> bool:
    return user_has_any_role(user, UserRole.system_admin, UserRole.company_admin, UserRole.manager)


@router.get("/courses", response_model=list[TrainingCourseSummaryOut])
async def list_courses(
    db: Db,
    cid: CompanyId,
    uid: Uid,
    user: Annotated[User, Depends(require_tenant_user)],
) -> list[TrainingCourseSummaryOut]:
    return await list_published_courses(
        db,
        company_id=cid,
        user_id=uid,
        include_drafts=_can_view_drafts(user),
    )


@router.get("/courses/{course_id}", response_model=TrainingCourseOut)
async def get_course(
    course_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> TrainingCourseOut:
    out = await get_course_detail(
        db,
        company_id=cid,
        course_id=course_id,
        include_drafts=_can_view_drafts(user),
    )
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return out


@router.get("/courses/{course_id}/lessons/{lesson_id}", response_model=TrainingLessonOut)
async def get_lesson(
    course_id: str,
    lesson_id: str,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_tenant_user)],
) -> TrainingLessonOut:
    out = await get_lesson_detail(
        db,
        company_id=cid,
        course_id=course_id,
        lesson_id=lesson_id,
        include_drafts=_can_view_drafts(user),
    )
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")
    return out


@router.post("/progress", response_model=TrainingUserProgressOut)
async def post_progress(
    body: TrainingProgressUpsertIn,
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingUserProgressOut:
    try:
        return await upsert_progress(db, company_id=cid, user_id=uid, body=body)
    except ValueError as exc:
        code = str(exc)
        if code in ("lesson_not_found", "course_not_found"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code) from exc


@router.get("/courses/{course_id}/flashcards", response_model=TrainingCourseFlashcardsOut)
async def course_flashcards(
    course_id: str,
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingCourseFlashcardsOut:
    try:
        return await list_course_flashcards(db, company_id=cid, user_id=uid, course_id=course_id)
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/courses/{course_id}/study-statistics", response_model=TrainingStudyStatisticsOut)
async def course_study_statistics(
    course_id: str,
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingStudyStatisticsOut:
    try:
        return await get_course_study_statistics(
            db, company_id=cid, user_id=uid, course_id=course_id
        )
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/study/due", response_model=TrainingStudyDueOut)
async def study_due(
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
    limit: int = Query(30, ge=1, le=100),
) -> TrainingStudyDueOut:
    return await list_due_flashcards(db, company_id=cid, user_id=uid, limit=limit)


@router.post("/study/review/{flashcard_id}", response_model=TrainingSm2StateOut)
async def study_review(
    flashcard_id: str,
    body: TrainingFlashcardReviewSubmit,
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingSm2StateOut:
    try:
        return await submit_flashcard_review(
            db,
            company_id=cid,
            user_id=uid,
            flashcard_id=flashcard_id,
            body=body,
        )
    except ValueError as exc:
        if str(exc) == "flashcard_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/learning-paths", response_model=list[TrainingLearningPathOut])
async def list_learning_paths(
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_tenant_user)],
) -> list[TrainingLearningPathOut]:
    return await list_published_paths(db, company_id=cid)


@router.get("/learning-paths/{path_id}", response_model=TrainingLearningPathOut)
async def get_learning_path(
    path_id: str,
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingLearningPathOut:
    out = await get_path_detail(db, company_id=cid, path_id=path_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learning path not found")
    return out


@router.get("/dashboard", response_model=TrainingDashboardOut)
async def training_dashboard(
    db: Db,
    cid: CompanyId,
    uid: Uid,
    _: Annotated[User, Depends(require_tenant_user)],
) -> TrainingDashboardOut:
    in_progress = await list_user_course_progress(db, company_id=cid, user_id=uid)
    active = [p for p in in_progress if p.status in ("in_progress", "not_started") and p.progress_pct < 100]
    due_count = await count_due_flashcards(db, company_id=cid, user_id=uid)
    return TrainingDashboardOut(
        courses_in_progress=active[:10],
        training_due=active[:5],
        study_streak_days=max((p.study_streak_days for p in in_progress), default=0),
        weak_topics=[],
        recent_activity=[],
    )


@router.post(
    "/import",
    response_model=TrainingImportResultOut,
    responses={
        201: {"description": "Import completed"},
        400: {"description": "Invalid JSON or validation failed", "model": TrainingImportResultOut},
    },
)
async def import_training_pack(
    request: Request,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingImportResultOut | JSONResponse:
    raw = await request.body()
    validation = parse_import_pack_json(raw)
    if not validation.ok:
        source = validation.pack.source_name if validation.pack else "unknown"
        payload = validation_failure_result(source, validation)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=payload.model_dump(),
        )

    pack = validation.pack
    assert pack is not None

    def _run(sync_session):  # type: ignore[no-untyped-def]
        svc = TrainingImportService(sync_session, company_id=cid, user_id=str(user.id))
        return svc.import_pack_from_validation(pack, validation)

    try:
        result = await db.run_sync(_run)
    except TrainingImportValidationError as exc:
        source = exc.result.pack.source_name if exc.result.pack else "unknown"
        payload = validation_failure_result(source, exc.result)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=payload.model_dump(),
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await db.commit()
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=result.model_dump())


@router.get("/decks", response_model=list[TrainingDeckSummaryOut])
async def list_decks(
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_manager_or_above)],
    include_archived: bool = Query(True),
) -> list[TrainingDeckSummaryOut]:
    return await list_training_decks(db, company_id=cid, include_archived=include_archived)


@router.post("/decks/validate", response_model=TrainingDeckValidationReportOut)
async def validate_deck(
    request: Request,
    _: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingDeckValidationReportOut:
    """Validate deck JSON without importing or modifying data."""
    raw = await request.body()
    report = validate_deck_pack(raw)
    return deck_validation_report_out(report)


@router.get("/decks/{course_id}/export")
async def export_deck(
    course_id: str,
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_manager_or_above)],
) -> JSONResponse:
    try:
        pack = await export_deck_pack(db, company_id=cid, course_id=course_id)
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    filename = f"{pack.courses[0].slug if pack.courses else 'deck'}.json"
    return JSONResponse(
        content=pack.model_dump(mode="json"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/decks/{course_id}/duplicate", response_model=TrainingDeckSummaryOut, status_code=status.HTTP_201_CREATED)
async def duplicate_deck_route(
    course_id: str,
    body: TrainingDeckDuplicateIn,
    db: Db,
    cid: CompanyId,
    user: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingDeckSummaryOut:
    try:
        result = await duplicate_deck(
            db,
            company_id=cid,
            course_id=course_id,
            body=body,
            user_id=str(user.id),
        )
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await db.commit()
    return result


@router.post("/decks/{course_id}/archive", response_model=TrainingDeckSummaryOut)
async def archive_deck_route(
    course_id: str,
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingDeckSummaryOut:
    try:
        result = await archive_deck(db, company_id=cid, course_id=course_id)
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await db.commit()
    return result


@router.patch("/decks/{course_id}", response_model=TrainingDeckSummaryOut)
async def rename_deck_route(
    course_id: str,
    body: TrainingDeckRenameIn,
    db: Db,
    cid: CompanyId,
    _: Annotated[User, Depends(require_manager_or_above)],
) -> TrainingDeckSummaryOut:
    try:
        result = await rename_deck(db, company_id=cid, course_id=course_id, body=body)
    except ValueError as exc:
        if str(exc) == "course_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await db.commit()
    return result
