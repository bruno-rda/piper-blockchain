import asyncio
import threading
import time

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import select

from app.crypto import (
    compute_block_hash,
    compute_merkle_root,
    generate_tx_hash,
    verify_pow,
)
from app.models.orm import Block, Transaction, TxOutput, Wallet
from app.models.schemas import TxOutputPayload


class BlockService:
    def __init__(
        self,
        db: AsyncSession,
        initial_supply_coins: int,
        block_reward_coins: int,
        difficulty: int,
        max_tx_per_block: int,
        units_per_coin: int,
    ):
        self.db = db
        self.initial_supply_coins = initial_supply_coins
        self.block_reward_coins = block_reward_coins
        self.difficulty = difficulty
        self.max_tx_per_block = max_tx_per_block
        self.units_per_coin = units_per_coin

        # Mining state
        self._mining_active = False
        self._mining_queue: asyncio.Queue | None = None
        self._mining_thread: threading.Thread | None = None
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def create_genesis_block(self, genesis_address: str) -> int:
        result = await self.db.execute(select(Block).limit(1))
        if result.scalars().first():
            raise ValueError("Blockchain already initialized.")

        initial_supply_units = self.initial_supply_coins * self.units_per_coin

        # Temporal output to compute the tx hash
        outputs = [
            TxOutputPayload(recipient=genesis_address, amount=initial_supply_units)
        ]
        tx_id = generate_tx_hash([], outputs)

        genesis_tx = Transaction(id=tx_id, is_coinbase=True, fee=0)
        genesis_tx.outputs.append(
            TxOutput(
                transaction_id=tx_id,
                output_index=0,
                recipient_address=genesis_address,
                amount=initial_supply_units,
            )
        )

        # Create genesis block
        block = Block(
            previous_hash="0" * 64,
            nonce=0,
            hash="",  # Will be filled by POW
            merkle_root=compute_merkle_root([tx_id]),
            miner_address=genesis_address,
            transactions=[genesis_tx],
        )

        # Mine POW
        event_generator = await self.start_mining(block)
        async for _ in event_generator:
            pass

        return block.height

    async def prepare_block(self, miner_address: str) -> Block:
        # Ensure blockchain is initialized
        result = await self.db.execute(
            select(Block).order_by(Block.height.desc()).limit(1)
        )
        latest_block = result.scalars().first()
        if not latest_block:
            raise ValueError("Genesis block not found.")

        # Get pending transactions
        tx_result = await self.db.execute(
            select(Transaction)
            .filter(Transaction.block_height == None)
            .order_by(
                # Get highest fee transactions first
                Transaction.fee.desc(),
                Transaction.timestamp.asc(),
            )
            .limit(self.max_tx_per_block)
        )
        pending_txs = tx_result.scalars().all()

        block_reward_units = self.block_reward_coins * self.units_per_coin

        # Create coinbase transaction
        reward_amount = block_reward_units + sum(tx.fee for tx in pending_txs)
        coinbase_outputs = [
            TxOutputPayload(recipient=miner_address, amount=reward_amount)
        ]
        coinbase_tx_id = generate_tx_hash([], coinbase_outputs)

        coinbase_tx = Transaction(id=coinbase_tx_id, is_coinbase=True, fee=0)
        coinbase_tx.outputs.append(
            TxOutput(
                transaction_id=coinbase_tx_id,
                output_index=0,
                recipient_address=miner_address,
                amount=reward_amount,
            )
        )

        # Combine coinbase and pending transactions
        all_txs = [coinbase_tx] + pending_txs
        return Block(
            previous_hash=latest_block.hash,
            nonce=0,
            hash="",  # Will be filled by POW
            merkle_root=compute_merkle_root([tx.id for tx in all_txs]),
            miner_address=miner_address,
            transactions=all_txs,
        )

    def _mine_worker(
        self,
        block: Block,
        difficulty: int,
        queue: asyncio.Queue,
        loop: asyncio.AbstractEventLoop,
    ):
        start_time = time.time()
        last_report = start_time
        hashes = 0
        nonce = 0

        REPORT_INTERVAL = 20.0  # max 20 updates/sec

        while True:
            block.nonce = nonce
            block_hash = compute_block_hash(
                block.height,
                block.previous_hash,
                block.timestamp,
                block.nonce,
                block.merkle_root,
            )

            hashes += 1
            now = time.time()

            if now - last_report >= REPORT_INTERVAL:
                payload = {
                    "nonce": nonce,
                    "hashrate": hashes / (now - start_time),
                    "elapsed": now - start_time,
                    "hash": block_hash,
                }
                try:
                    asyncio.run_coroutine_threadsafe(queue.put(payload), loop)
                except RuntimeError:
                    # loop closed
                    break
                last_report = now

            if verify_pow(block_hash, difficulty):
                block.hash = block_hash
                try:
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"done": True, "nonce": nonce, "hash": block_hash}),
                        loop,
                    )
                except RuntimeError:
                    pass
                break

            nonce += 1

    async def start_mining(self, block: Block):
        if self._mining_active:
            raise RuntimeError("Mining already in progress")

        await self._lock.acquire()
        self._loop = asyncio.get_running_loop()
        self._mining_queue = asyncio.Queue()
        self._mining_active = True

        self._mining_thread = threading.Thread(
            target=self._mine_worker,
            args=(block, self.difficulty, self._mining_queue, self._loop),
            daemon=True,
        )
        self._mining_thread.start()

        async def generator():
            try:
                while True:
                    event = await self._mining_queue.get()
                    yield event
                    if event.get("done"):
                        # persist block
                        self.db.add(block)
                        await self.db.commit()
                        break
            finally:
                self._mining_active = False
                self._mining_queue = None
                self._mining_thread = None
                if self._lock.locked():
                    self._lock.release()

        return generator()

    async def get_blocks(self, limit: int = 20, offset: int = 0) -> list[Block]:
        result = await self.db.execute(
            select(Block)
            .options(
                selectinload(Block.transactions),
                selectinload(Block.miner_wallet)
                    .selectinload(Wallet.owner)
            )
            .order_by(Block.height.desc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().unique().all()

    async def get_latest_block(self) -> Block:
        result = await self.db.execute(
            select(Block)
            .options(
                selectinload(Block.transactions),
                selectinload(Block.miner_wallet)
                    .selectinload(Wallet.owner)
            )
            .order_by(Block.height.desc())
            .limit(1)
        )
        block = result.scalars().first()
        if not block:
            raise ValueError("No blocks found")

        return block

    async def get_block(self, height: int) -> Block:
        result = await self.db.execute(
            select(Block)
            .options(
                selectinload(Block.transactions)
                    .selectinload(Transaction.inputs),
                selectinload(Block.transactions)
                    .selectinload(Transaction.outputs),
                selectinload(Block.miner_wallet)
                    .selectinload(Wallet.owner)
            )
            .filter(Block.height == height)
        )
        block = result.scalars().first()
        if not block:
            raise ValueError("Block not found")

        return block
