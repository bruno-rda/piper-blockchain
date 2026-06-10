from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_user_service
from app.models.schemas import UserAuthenticateRequest, UserCreateRequest, UserResponse
from app.services.user import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserResponse)
async def create_user(
    request: UserCreateRequest,
    user_service: UserService = Depends(get_user_service),
):
    try:
        user_id = await user_service.create_user(request.username, request.password)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return UserResponse(user_id=user_id, username=request.username)


# Authenticate user
@router.post("/authenticate", response_model=UserResponse)
async def authenticate_user(
    request: UserAuthenticateRequest,
    user_service: UserService = Depends(get_user_service),
):
    user_id = await user_service.authenticate_user(request.username, request.password)
    return UserResponse(user_id=user_id, username=request.username)
