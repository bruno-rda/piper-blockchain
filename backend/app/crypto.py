import hashlib
import json

import bcrypt
from ecdsa import BadSignatureError, SECP256k1, VerifyingKey
from ecdsa.util import sigdecode_der

from app.models.schemas import TxInputPayload, TxOutputPayload


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def compute_merkle_root(tx_ids: list[str]) -> str:
    if not tx_ids:
        return hashlib.sha256(b"").hexdigest()

    hashes = [bytes.fromhex(tid) for tid in tx_ids]
    while len(hashes) > 1:
        if len(hashes) % 2 == 1:
            hashes.append(hashes[-1])

        next_level = []
        for i in range(0, len(hashes), 2):
            combined = hashes[i] + hashes[i + 1]
            hashed = hashlib.sha256(hashlib.sha256(combined).digest()).digest()
            next_level.append(hashed)
        hashes = next_level

    return hashes[0].hex()


def generate_tx_hash(
    inputs: list[TxInputPayload], outputs: list[TxOutputPayload]
) -> str:
    clean_inputs = [
        {"ref_tx_id": inp.ref_tx_id, "ref_output_index": inp.ref_output_index}
        for inp in inputs
    ]
    clean_outputs = [
        {"recipient": out.recipient, "amount": out.amount} for out in outputs
    ]
    tx_data = json.dumps(
        {"inputs": clean_inputs, "outputs": clean_outputs}, sort_keys=True
    ).encode("utf-8")

    return hashlib.sha256(hashlib.sha256(tx_data).digest()).hexdigest()


def verify_ecdsa_signature(
    public_key_hex: str, signature_hex: str, message: str
) -> bool:
    try:
        vk = VerifyingKey.from_string(bytes.fromhex(public_key_hex), curve=SECP256k1)
        return vk.verify(
            bytes.fromhex(signature_hex),
            message.encode(),
            hashfunc=hashlib.sha256,
            sigdecode=sigdecode_der,
        )
    except (BadSignatureError, Exception):
        return False


def compute_block_hash(
    height: int, previous_hash: str, timestamp: int, nonce: int, merkle_root: str
) -> str:
    header = f"{height}{previous_hash}{timestamp}{nonce}{merkle_root}"
    return hashlib.sha256(header.encode()).hexdigest()


def verify_pow(block_hash: str, difficulty: int) -> bool:
    return block_hash.startswith("0" * difficulty)
