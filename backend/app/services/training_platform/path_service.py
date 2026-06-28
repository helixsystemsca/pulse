"""Learning path catalog."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.training_platform_models import TrainingLearningPath
from app.schemas.training_platform import TrainingLearningPathOut
from app.services.training_platform.serializers import learning_path_out


async def list_published_paths(
    db: AsyncSession,
    *,
    company_id: str,
) -> list[TrainingLearningPathOut]:
    rows = list(
        (
            await db.execute(
                select(TrainingLearningPath)
                .where(
                    TrainingLearningPath.company_id == company_id,
                    TrainingLearningPath.is_published.is_(True),
                )
                .options(selectinload(TrainingLearningPath.items))
                .order_by(TrainingLearningPath.title)
            )
        ).scalars().all()
    )
    return [learning_path_out(p) for p in rows]


async def get_path_detail(
    db: AsyncSession,
    *,
    company_id: str,
    path_id: str,
) -> TrainingLearningPathOut | None:
    row = (
        await db.execute(
            select(TrainingLearningPath)
            .where(
                TrainingLearningPath.company_id == company_id,
                TrainingLearningPath.id == path_id,
                TrainingLearningPath.is_published.is_(True),
            )
            .options(selectinload(TrainingLearningPath.items))
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    return learning_path_out(row)
