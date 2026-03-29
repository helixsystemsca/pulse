from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import NotificationLog


async def log_notification(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str | None,
    title: str,
    body: str = "",
    channel: str = "log",
) -> None:
    db.add(
        NotificationLog(
            company_id=company_id,
            user_id=user_id,
            channel=channel,
            title=title,
            body=body,
        )
    )
