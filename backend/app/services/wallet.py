from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func, select

from app.models.orm import Transaction, TxOutput, Wallet


class WalletService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_wallet(
        self, user_id: str, address: str, public_key: str, encrypted_private_key: str
    ) -> str:
        wallet = Wallet(
            address=address,
            owner_id=user_id,
            public_key=public_key,
            encrypted_private_key=encrypted_private_key,
        )
        self.db.add(wallet)
        await self.db.commit()
        return wallet.address

    async def get_balance(self, address: str) -> int:
        result = await self.db.execute(
            select(func.sum(TxOutput.amount)).filter(
                TxOutput.recipient_address == address, TxOutput.is_spent == False
            )
        )
        return result.scalar() or 0

    async def get_transactions(self, address: str) -> list[Transaction]:
        result = await self.db.execute(
            select(Transaction)
            .join(TxOutput, Transaction.id == TxOutput.transaction_id)
            .options(
                selectinload(Transaction.inputs),
                selectinload(Transaction.outputs),
            )
            .filter(TxOutput.recipient_address == address)
        )
        return result.scalars().all()

    async def get_all_wallet_balances(self) -> list[dict]:
        result = await self.db.execute(select(Wallet).options(selectinload(Wallet.owner)))
        wallets = result.scalars().all()

        balances = []
        for wallet in wallets:
            balance = await self.get_balance(wallet.address)
            transactions = await self.get_transactions(wallet.address)
            balances.append({
                "username": wallet.owner.username,
                "wallet_address": wallet.address,
                "balance": balance,
                "transaction_count": len(transactions)
            })
        return balances
