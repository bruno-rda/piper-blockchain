from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import select

from app.models.orm import BlockchainConfig


class ConfigService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_default_config(
        self,
        difficulty: int,
        block_reward_coins: int,
        max_tx_per_block: int,
        initial_supply_coins: int,
        units_per_coin: int,
        coin_name: str,
        unit_name: str,
    ) -> BlockchainConfig:
        config = await self.get_config()
        if config:
            return config

        config = BlockchainConfig(
            difficulty=difficulty,
            block_reward_coins=block_reward_coins,
            max_tx_per_block=max_tx_per_block,
            initial_supply_coins=initial_supply_coins,
            units_per_coin=units_per_coin,
            coin_name=coin_name,
            unit_name=unit_name,
        )

        self.db.add(config)
        await self.db.commit()
        return config

    async def get_config(self) -> BlockchainConfig:
        result = await self.db.execute(select(BlockchainConfig))
        return result.scalars().first()

    async def update_config(
        self,
        difficulty: int | None = None,
        block_reward_coins: int | None = None,
        max_tx_per_block: int | None = None,
        initial_supply_coins: int | None = None,
        units_per_coin: int | None = None,
        coin_name: str | None = None,
        unit_name: str | None = None,
    ) -> BlockchainConfig:
        config = await self.get_config()
        if not config:
            raise ValueError("Config not found")

        if difficulty:
            config.difficulty = difficulty
        if block_reward_coins:
            config.block_reward_coins = block_reward_coins
        if max_tx_per_block:
            config.max_tx_per_block = max_tx_per_block
        if initial_supply_coins:
            config.initial_supply_coins = initial_supply_coins
        if units_per_coin:
            config.units_per_coin = units_per_coin
        if coin_name:
            config.coin_name = coin_name
        if unit_name:
            config.unit_name = unit_name

        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)
        return config
