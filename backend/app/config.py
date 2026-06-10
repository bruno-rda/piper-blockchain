from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    admin_password: str

    # Blockchain default config
    difficulty: int = 4
    block_reward_coins: int = 3
    max_tx_per_block: int = 10
    initial_supply_coins: int = 1_000
    units_per_coin: int = 1_000
    coin_name: str = "Piper"
    unit_name: str = "Pips"

    model_config = SettingsConfigDict(
        env_file="../.env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
