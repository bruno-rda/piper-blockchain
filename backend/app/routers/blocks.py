from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import get_block_service
from app.models.schemas import (
    BlockDetailResponse,
    BlockMiningRequest,
    BlockResponse,
    BlocksRequest,
    TransactionDetailResponse,
    TransactionInputDetail,
    TransactionOutputDetail,
)
from app.services.block import BlockService

router = APIRouter(prefix="/blocks", tags=["Blocks"])

mining_status = {"active": False, "miner_address": None}


@router.get("", response_model=list[BlockResponse])
async def get_blocks(
    request: BlocksRequest = Depends(),
    block_service: BlockService = Depends(get_block_service),
):
    blocks = await block_service.get_blocks(request.limit, request.offset)
    return [
        BlockResponse(
            height=b.height,
            hash=b.hash,
            previous_hash=b.previous_hash,
            timestamp=b.timestamp,
            tx_count=len(b.transactions),
            miner_address=b.miner_address,
            miner_username=b.miner_wallet.owner.username,
            nonce=b.nonce,
            merkle_root=b.merkle_root,
        )
        for b in blocks
    ]


@router.get("/latest", response_model=BlockResponse)
async def get_latest_block(block_service: BlockService = Depends(get_block_service)):
    block = await block_service.get_latest_block()
    return BlockResponse(
        height=block.height,
        hash=block.hash,
        previous_hash=block.previous_hash,
        timestamp=block.timestamp,
        tx_count=len(block.transactions),
        miner_address=block.miner_address,
        miner_username=block.miner_wallet.owner.username,
        nonce=block.nonce,
        merkle_root=block.merkle_root,
    )


@router.get("/{height}", response_model=BlockDetailResponse)
async def get_block(
    height: int, block_service: BlockService = Depends(get_block_service)
):
    block = await block_service.get_block(height)
    return BlockDetailResponse(
        height=block.height,
        hash=block.hash,
        previous_hash=block.previous_hash,
        timestamp=block.timestamp,
        tx_count=len(block.transactions),
        miner_address=block.miner_address,
        miner_username=block.miner_wallet.owner.username,
        nonce=block.nonce,
        merkle_root=block.merkle_root,
        transactions=[
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
                    TransactionOutputDetail(
                        recipient=o.recipient_address, amount=o.amount
                    )
                    for o in tx.outputs
                ],
                fee=tx.fee,
                block_height=tx.block_height,
                is_coinbase=tx.is_coinbase,
            )
            for tx in block.transactions
        ],
    )


@router.post("/mining/start")
async def start_mining(
    request: BlockMiningRequest,
    block_service: BlockService = Depends(get_block_service),
):
    if mining_status["active"]:
        raise HTTPException(status_code=400, detail="Mining already in progress")

    block = await block_service.prepare_block(request.miner_wallet_address)
    event_generator = await block_service.start_mining(block)

    async def event_stream():
        async for event in event_generator:
            yield f"data: {event}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
