import time
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from app.config import settings
from app.deps import get_block_service, get_config_service, get_db
from app.models.schemas import (
    AdminConfigRequest,
    AdminInitRequest,
    AdminTokenResponse,
    AdminVerifyRequest,
    BasicResponse,
    ConfigResponse,
    ResetRequest,
)
from app.services.block import BlockService
from app.services.config import ConfigService

router = APIRouter(prefix="/admin", tags=["Admin"])

# In-memory token store
admin_tokens = {}


def verify_admin_token(token: str):
    if token not in admin_tokens:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    if time.time() > admin_tokens[token]:
        del admin_tokens[token]
        raise HTTPException(status_code=401, detail="Admin token expired")


async def get_admin_token(admin_token: str = Header(...)):
    verify_admin_token(admin_token)
    return admin_token


@router.post("/verify", response_model=AdminTokenResponse)
async def verify_admin(request: AdminVerifyRequest):
    if request.admin_password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid admin password")

    token = uuid.uuid4().hex
    admin_tokens[token] = time.time() + 3600
    return AdminTokenResponse(session_token=token)


@router.post("/init", response_model=BasicResponse)
async def init_blockchain(
    request: AdminInitRequest,
    block_service: BlockService = Depends(get_block_service),
    admin_token: str = Depends(get_admin_token),
):
    try:
        await block_service.create_genesis_block(request.miner_address)
        return BasicResponse(
            success=True, message=f"Genesis block created successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/config", response_model=ConfigResponse)
async def update_config(
    request: AdminConfigRequest,
    config_service: ConfigService = Depends(get_config_service),
    admin_token: str = Depends(get_admin_token),
):
    config = await config_service.update_config(
        difficulty=request.difficulty,
        block_reward_coins=request.block_reward_coins,
        max_tx_per_block=request.max_transactions_per_block,
        units_per_coin=request.units_per_coin,
    )

    return ConfigResponse(
        difficulty=config.difficulty,
        block_reward_coins=config.block_reward_coins,
        max_tx_per_block=config.max_tx_per_block,
        units_per_coin=config.units_per_coin,
        coin_name=config.coin_name,
        unit_name=config.unit_name,
    )


@router.post("/reset", response_model=BasicResponse)
async def reset_chain(
    request: ResetRequest,
    db: AsyncSession = Depends(get_db),
    admin_token: str = Depends(get_admin_token),
):
    if request.confirmation != "RESET":
        raise HTTPException(status_code=400, detail="Invalid confirmation string")

    try:
        await db.execute(text("DELETE FROM tx_inputs;"))
        await db.execute(text("DELETE FROM tx_outputs;"))
        await db.execute(text("DELETE FROM transactions;"))
        await db.execute(text("DELETE FROM blocks;"))

        if request.reset_profiles:
            await db.execute(text("DELETE FROM users;"))
            await db.execute(text("DELETE FROM wallets;"))
            message = "Chain and profiles wiped successfully."
        else:
            message = "Chain wiped successfully."

        await db.commit()
        return BasicResponse(success=True, message=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
