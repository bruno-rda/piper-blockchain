from typing import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.block import BlockService
from app.services.config import ConfigService
from app.services.transaction import TransactionService
from app.services.user import UserService
from app.services.wallet import WalletService


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with request.app.state.db() as session:
        yield session


async def get_config_service(db: AsyncSession = Depends(get_db)) -> ConfigService:
    return ConfigService(db=db)


async def get_block_service(
    db: AsyncSession = Depends(get_db),
    config_service: ConfigService = Depends(get_config_service),
) -> BlockService:
    config = await config_service.get_config()

    return BlockService(
        db=db,
        initial_supply_coins=config.initial_supply_coins,
        block_reward_coins=config.block_reward_coins,
        difficulty=config.difficulty,
        max_tx_per_block=config.max_tx_per_block,
        units_per_coin=config.units_per_coin,
    )


def get_transaction_service(db: AsyncSession = Depends(get_db)) -> TransactionService:
    return TransactionService(db=db)


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db=db)


def get_wallet_service(db: AsyncSession = Depends(get_db)) -> WalletService:
    return WalletService(db=db)
