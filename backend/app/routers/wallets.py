from fastapi import APIRouter, Depends

from app.deps import get_wallet_service
from app.models.schemas import (
    BasicResponse,
    TransactionDetailResponse,
    TransactionInputDetail,
    TransactionOutputDetail,
    WalletCreateRequest,
    WalletBalanceResponse,
)
from app.services.wallet import WalletService

router = APIRouter(prefix="/wallets", tags=["Wallets"])


@router.get("/balances/all", response_model=list[WalletBalanceResponse])
async def get_all_balances(wallet_service: WalletService = Depends(get_wallet_service)):
    return await wallet_service.get_all_wallet_balances()


@router.post("", response_model=BasicResponse)
async def create_wallet(
    request: WalletCreateRequest,
    wallet_service: WalletService = Depends(get_wallet_service),
):
    await wallet_service.create_wallet(
        request.user_id,
        request.address,
        request.public_key,
        request.encrypted_private_key,
    )

    return BasicResponse(
        success=True,
        message=f"Wallet {request.address} registered to {request.user_id}",
    )


@router.get("/{address}/balance", response_model=int)
async def get_wallet_balance(
    address: str, wallet_service: WalletService = Depends(get_wallet_service)
):
    return await wallet_service.get_balance(address)


@router.get("/{address}/transactions", response_model=list[TransactionDetailResponse])
async def get_wallet_transactions(
    address: str, wallet_service: WalletService = Depends(get_wallet_service)
):
    transactions = await wallet_service.get_transactions(address)
    return [
        TransactionDetailResponse(
            id=tx.id,
            timestamp=tx.timestamp,
            inputs=[
                TransactionInputDetail(
                    ref_tx_id=i.referenced_tx_id,
                    ref_output_index=i.referenced_output_index,
                    signature=i.signature,
                )
                for i in tx.inputs
            ],
            outputs=[
                TransactionOutputDetail(recipient=o.recipient_address, amount=o.amount)
                for o in tx.outputs
            ],
            fee=tx.fee,
            block_height=tx.block_height,
            is_coinbase=tx.is_coinbase,
        )
        for tx in transactions
    ]
