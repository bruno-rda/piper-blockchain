from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.routing import APIRoute
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings
from app.models.orm import Base
from app.routers import admin, blocks, config, transactions, users, wallets
from app.services.config import ConfigService


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    app.state.db = AsyncSessionLocal

    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Setup default config
    async with app.state.db() as db:
        config_service = ConfigService(db=db)
        await config_service.create_default_config(
            difficulty=settings.difficulty,
            block_reward_coins=settings.block_reward_coins,
            max_tx_per_block=settings.max_tx_per_block,
            initial_supply_coins=settings.initial_supply_coins,
            units_per_coin=settings.units_per_coin,
            coin_name=settings.coin_name,
            unit_name=settings.unit_name,
        )

    yield

    await engine.dispose()


app = FastAPI(
    title="PiperChain API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(wallets.router)
app.include_router(transactions.router)
app.include_router(blocks.router)
app.include_router(admin.router)
app.include_router(config.router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/")
async def root():
    return RedirectResponse(url="/docs")


# Set operation_id for each route
for route in app.routes:
    if isinstance(route, APIRoute):
        route.operation_id = route.name
