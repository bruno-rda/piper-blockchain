from fastapi import APIRouter, Depends

from app.deps import get_config_service
from app.models.schemas import ConfigResponse
from app.services.config import ConfigService

router = APIRouter(prefix="/config", tags=["Config"])


@router.get("", response_model=ConfigResponse)
async def get_config(
    config_service: ConfigService = Depends(get_config_service),
):
    config = await config_service.get_config()
    return ConfigResponse(
        difficulty=config.difficulty,
        block_reward_coins=config.block_reward_coins,
        max_tx_per_block=config.max_tx_per_block,
        units_per_coin=config.units_per_coin,
        coin_name=config.coin_name,
        unit_name=config.unit_name,
    )
