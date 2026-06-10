from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_transaction_service
from app.models.schemas import (
    BasicResponse,
    MempoolStatusResponse,
    TransactionDetailResponse,
    TransactionInputDetail,
    TransactionMempoolResponse,
    TransactionOutputDetail,
    TransactionPrepareRequest,
    TransactionPrepareResponse,
    TransactionSubmitRequest,
)
from app.services.transaction import TransactionService

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/prepare", response_model=TransactionPrepareResponse)
async def prepare_transaction(
    request: TransactionPrepareRequest,
    tx_service: TransactionService = Depends(get_transaction_service),
):
    try:
        payload = await tx_service.prepare_transaction(
            sender_address=request.sender_address,
            outputs=request.outputs,
            fee=request.fee,
        )
        return TransactionPrepareResponse(
            tx_id=payload.tx_id,
            inputs=payload.inputs,
            outputs=payload.outputs,
            fee=payload.fee,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=BasicResponse)
async def submit_transaction(
    request: TransactionSubmitRequest,
    tx_service: TransactionService = Depends(get_transaction_service),
):
    try:
        tx_id = await tx_service.submit_transaction(request)
        return BasicResponse(
            success=True, message=f"Transaction {tx_id} entered mempool."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mempool", response_model=list[TransactionMempoolResponse])
async def get_mempool(
    tx_service: TransactionService = Depends(get_transaction_service),
):
    txs = await tx_service.get_mempool()
    result = []

    for tx in txs:
        if not tx.inputs:
            continue

        ref_output = tx.inputs[0].referenced_output
        if not ref_output:
            continue

        amount = sum(
            o.amount 
            for o in tx.outputs
            # Exclude change
            if o.recipient_address != ref_output.recipient_address
        )

        result.append(
            TransactionMempoolResponse(
                id=tx.id,
                sender_address=ref_output.recipient_address,
                sender_username=ref_output.recipient_wallet.owner.username,
                amount=amount,
                fee=tx.fee,
                timestamp=tx.timestamp,
            )
        )

    return result


@router.get("/mempool/status", response_model=MempoolStatusResponse)
async def get_mempool_status():
    from app.routers.blocks import mining_status

    return MempoolStatusResponse(
        mining_active=mining_status["active"],
        miner_address=mining_status["miner_address"],
    )


@router.get("/{tx_id}", response_model=TransactionDetailResponse)
async def get_transaction(
    tx_id: str, tx_service: TransactionService = Depends(get_transaction_service)
):
    try:
        tx = await tx_service.get_transaction(tx_id)
        return TransactionDetailResponse(
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
