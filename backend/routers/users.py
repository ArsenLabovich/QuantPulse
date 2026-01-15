from fastapi import APIRouter, Depends
from schemas.user import User
from core.deps import get_current_user
from models.user import User as UserModel

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=User)
async def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user
