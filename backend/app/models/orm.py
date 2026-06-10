from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    and_,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    event,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)

    wallets = relationship("Wallet", back_populates="owner")


class Wallet(Base):
    __tablename__ = "wallets"
    address = Column(String, primary_key=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    public_key = Column(String, nullable=False)
    encrypted_private_key = Column(String, nullable=False)

    owner = relationship("User", back_populates="wallets")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)
    block_height = Column(
        Integer, ForeignKey("blocks.height"), nullable=True, index=True
    )
    timestamp = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    is_coinbase = Column(Boolean, default=False)
    fee = Column(BigInteger, default=0)

    inputs = relationship(
        "TxInput", back_populates="transaction", cascade="all, delete-orphan"
    )
    outputs = relationship(
        "TxOutput", back_populates="transaction", cascade="all, delete-orphan"
    )
    block = relationship("Block", back_populates="transactions")


class TxInput(Base):
    __tablename__ = "tx_inputs"
    transaction_id = Column(
        String, ForeignKey("transactions.id"), nullable=False, primary_key=True
    )
    referenced_tx_id = Column(String, nullable=False, primary_key=True)
    referenced_output_index = Column(Integer, nullable=False, primary_key=True)
    signature = Column(String, nullable=False)

    transaction = relationship("Transaction", back_populates="inputs")

    referenced_output = relationship(
        "TxOutput",
        primaryjoin=lambda: and_(
            TxInput.referenced_tx_id == TxOutput.transaction_id,
            TxInput.referenced_output_index == TxOutput.output_index,
        ),
        foreign_keys=lambda: [
            TxInput.referenced_tx_id,
            TxInput.referenced_output_index,
        ],
        uselist=False,
        viewonly=True,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["referenced_tx_id", "referenced_output_index"],
            ["tx_outputs.transaction_id", "tx_outputs.output_index"],
        ),
        Index("ix_tx_inputs_ref", "referenced_tx_id", "referenced_output_index"),
    )


class TxOutput(Base):
    __tablename__ = "tx_outputs"
    transaction_id = Column(
        String, ForeignKey("transactions.id"), nullable=False, primary_key=True
    )
    output_index = Column(Integer, nullable=False, primary_key=True)
    recipient_address = Column(String, ForeignKey("wallets.address"), nullable=False)
    amount = Column(BigInteger, nullable=False)
    is_spent = Column(Boolean, default=False, index=True)

    transaction = relationship("Transaction", back_populates="outputs")
    recipient_wallet = relationship("Wallet")


class Block(Base):
    __tablename__ = "blocks"
    height = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    previous_hash = Column(String, nullable=False)
    nonce = Column(Integer, nullable=False)
    hash = Column(String, unique=True, nullable=False, index=True)
    merkle_root = Column(String, nullable=False)
    miner_address = Column(String, ForeignKey("wallets.address"), nullable=False)

    transactions = relationship(
        "Transaction", back_populates="block", cascade="all, delete-orphan"
    )
    miner_wallet = relationship("Wallet")


class BlockchainConfig(Base):
    __tablename__ = "blockchain_config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    difficulty = Column(Integer, nullable=False)
    block_reward_coins = Column(Integer, nullable=False)
    max_tx_per_block = Column(Integer, nullable=False)
    initial_supply_coins = Column(Integer, nullable=False)
    units_per_coin = Column(BigInteger, nullable=False)
    coin_name = Column(String, nullable=False)
    unit_name = Column(String, nullable=False)


@event.listens_for(TxInput, "after_insert")
def mark_output_as_spent(mapper, connection, target):
    connection.execute(
        TxOutput.__table__.update()
        .where(
            (TxOutput.transaction_id == target.referenced_tx_id)
            & (TxOutput.output_index == target.referenced_output_index)
        )
        .values(is_spent=True)
    )


@event.listens_for(TxInput, "after_delete")
def unspend_output(mapper, connection, target):
    connection.execute(
        TxOutput.__table__.update()
        .where(
            (TxOutput.transaction_id == target.referenced_tx_id)
            & (TxOutput.output_index == target.referenced_output_index)
        )
        .values(is_spent=False)
    )
