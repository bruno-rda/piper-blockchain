from datetime import datetime

from pydantic import BaseModel


class BasicResponse(BaseModel):
    success: bool
    message: str | None = None


class ConfigResponse(BaseModel):
    difficulty: int
    block_reward_coins: int
    max_tx_per_block: int
    units_per_coin: int
    coin_name: str
    unit_name: str


# Admin


class AdminVerifyRequest(BaseModel):
    admin_password: str


class AdminTokenResponse(BaseModel):
    session_token: str


class AdminInitRequest(BaseModel):
    miner_address: str


class AdminConfigRequest(BaseModel):
    difficulty: int | None = None
    block_reward_coins: int | None = None
    max_transactions_per_block: int | None = None
    units_per_coin: int | None = None


class ResetRequest(BaseModel):
    confirmation: str
    reset_profiles: bool


# Users


class UserCreateRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    username: str


class UserAuthenticateRequest(BaseModel):
    username: str
    password: str


# Wallets


class WalletCreateRequest(BaseModel):
    user_id: str
    address: str
    public_key: str
    encrypted_private_key: str


class BalanceResponse(BaseModel):
    balance: int


class WalletBalanceResponse(BaseModel):
    username: str
    wallet_address: str
    balance: int
    transaction_count: int


class TransactionOutputDetail(BaseModel):
    recipient: str
    amount: int


class TransactionInputDetail(BaseModel):
    ref_tx_id: str
    ref_output_index: int
    signature: str


class TransactionDetailResponse(BaseModel):
    id: str
    timestamp: datetime
    inputs: list[TransactionInputDetail]
    outputs: list[TransactionOutputDetail]
    fee: int
    block_height: int | None = None
    is_coinbase: bool


# Transactions


class TxInputPayload(BaseModel):
    ref_tx_id: str
    ref_output_index: int
    message_to_sign: str | None = None
    signature: str | None = None


class TxOutputPayload(BaseModel):
    recipient: str
    amount: int


class TransactionPayload(BaseModel):
    tx_id: str
    inputs: list[TxInputPayload]
    outputs: list[TxOutputPayload]
    fee: int


class TransactionPrepareRequest(BaseModel):
    sender_address: str
    outputs: list[TxOutputPayload]
    fee: int = 0


class TransactionPrepareResponse(TransactionPayload): ...


class TransactionSubmitRequest(TransactionPayload): ...


class TransactionMempoolResponse(BaseModel):
    id: str
    sender_address: str
    sender_username: str | None = None
    amount: int
    fee: int
    timestamp: datetime


class MempoolStatusResponse(BaseModel):
    mining_active: bool
    miner_address: str | None = None


# Blocks


class BlocksRequest(BaseModel):
    limit: int = 20
    offset: int = 0


class BlockResponse(BaseModel):
    height: int
    hash: str
    previous_hash: str
    timestamp: datetime
    tx_count: int
    miner_address: str
    miner_username: str | None = None
    nonce: int
    merkle_root: str


class BlockDetailResponse(BlockResponse):
    transactions: list[TransactionDetailResponse]


class BlockMiningRequest(BaseModel):
    miner_wallet_address: str
