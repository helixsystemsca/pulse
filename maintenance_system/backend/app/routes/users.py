from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import AdminUser, CurrentUser
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import user_service
from app.services.audit import write_audit

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> list[UserOut]:
    users = await user_service.list_users(db, admin.company_id)
    return [UserOut.model_validate(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    try:
        user = await user_service.create_user(db, admin.company_id, data)
        await write_audit(
            db,
            company_id=admin.company_id,
            actor_user_id=admin.id,
            action="user.create",
            entity_type="user",
            entity_id=user.id,
            payload={"email": user.email, "role": user.role.value},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser) -> UserOut:
    return UserOut.model_validate(current)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    u = await user_service.get_user(db, current.company_id, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(u)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    data: UserUpdate,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    u = await user_service.get_user(db, admin.company_id, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        u = await user_service.update_user(db, u, data)
        await write_audit(
            db,
            company_id=admin.company_id,
            actor_user_id=admin.id,
            action="user.update",
            entity_type="user",
            entity_id=u.id,
            payload=data.model_dump(exclude_unset=True),
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return UserOut.model_validate(u)
