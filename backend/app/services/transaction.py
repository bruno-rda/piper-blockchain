from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import select

from app.crypto import generate_tx_hash, verify_ecdsa_signature
from app.models.orm import Transaction, TxInput, TxOutput, Wallet
from app.models.schemas import TransactionPayload, TxInputPayload, TxOutputPayload


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def prepare_transaction(
        self, sender_address: str, outputs: list[TxOutputPayload], fee: int = 0
    ) -> TransactionPayload:
        amount = sum(out.amount for out in outputs)
        if amount <= 0:
            raise ValueError("Amount must be greater than 0.")

        result = await self.db.execute(
            select(TxOutput).filter(
                TxOutput.recipient_address == sender_address, TxOutput.is_spent == False
            )
        )
        utxos = result.scalars().all()

        # Check if sender has sufficient funds
        target_amount = amount + fee
        if sum(u.amount for u in utxos) < target_amount:
            raise ValueError("Insufficient funds.")

        # Create inputs
        inputs: list[TxInputPayload] = []
        accumulated = 0

        for u in utxos:
            inputs.append(
                TxInputPayload(
                    ref_tx_id=u.transaction_id,
                    ref_output_index=u.output_index,
                )
            )
            accumulated += u.amount
            if accumulated >= target_amount:
                break

        # Create change output if needed
        change = accumulated - target_amount
        if change > 0:
            outputs.append(TxOutputPayload(recipient=sender_address, amount=change))

        tx_id = generate_tx_hash(inputs, outputs)

        for inp in inputs:
            inp.message_to_sign = f"{tx_id}:{inp.ref_tx_id}:{inp.ref_output_index}"

        return TransactionPayload(tx_id=tx_id, inputs=inputs, outputs=outputs, fee=fee)

    async def submit_transaction(self, transaction: TransactionPayload) -> str:
        # Confirm payload integrity
        expected_tx_id = generate_tx_hash(transaction.inputs, transaction.outputs)
        if transaction.tx_id != expected_tx_id:
            raise ValueError("Transaction hash mismatch. Payload altered.")

        # Ensure transaction has inputs
        if not transaction.inputs:
            raise ValueError("Standard transaction must have inputs.")

        for inp in transaction.inputs:
            if not inp.signature:
                raise ValueError("Missing signature on input.")

            utxo_result = await self.db.execute(
                select(TxOutput)
                .filter(
                    TxOutput.transaction_id == inp.ref_tx_id,
                    TxOutput.output_index == inp.ref_output_index,
                )
                .limit(1)
            )
            utxo = utxo_result.scalars().first()

            if not utxo or utxo.is_spent:
                raise ValueError("UTXO invalid or spent.")

            # Verify signature was signed by the owner of the UTXO
            wallet_result = await self.db.execute(
                select(Wallet).filter(Wallet.address == utxo.recipient_address).limit(1)
            )
            wallet = wallet_result.scalars().first()
            if not verify_ecdsa_signature(
                public_key_hex=wallet.public_key,
                signature_hex=inp.signature,
                message=inp.message_to_sign,
            ):
                raise ValueError("Invalid cryptographic signature.")

        # Create transaction
        tx = Transaction(id=expected_tx_id, fee=transaction.fee)
        for inp in transaction.inputs:
            tx.inputs.append(
                TxInput(
                    transaction_id=expected_tx_id,
                    referenced_tx_id=inp.ref_tx_id,
                    referenced_output_index=inp.ref_output_index,
                    signature=inp.signature,
                )
            )
        for idx, out in enumerate(transaction.outputs):
            tx.outputs.append(
                TxOutput(
                    transaction_id=expected_tx_id,
                    output_index=idx,
                    recipient_address=out.recipient,
                    amount=out.amount,
                )
            )

        self.db.add(tx)
        await self.db.commit()
        return tx.id

    async def get_transaction(self, tx_id: str) -> Transaction:
        result = await self.db.execute(
            select(Transaction)
            .options(
                selectinload(Transaction.inputs), selectinload(Transaction.outputs)
            )
            .filter(Transaction.id == tx_id)
            .limit(1)
        )
        tx = result.scalars().first()
        if not tx:
            raise ValueError("Transaction not found")

        return tx

    async def get_mempool(self) -> list[Transaction]:
        result = await self.db.execute(
            select(Transaction)
            .options(
                selectinload(Transaction.inputs)
                    .selectinload(TxInput.referenced_output)
                    .selectinload(TxOutput.recipient_wallet)
                    .selectinload(Wallet.owner),
                selectinload(Transaction.outputs)
            )
            .filter(Transaction.block_height == None)
            .order_by(
                Transaction.fee.desc(),
                Transaction.timestamp.asc()
            )
        )
        return result.scalars().unique().all()
