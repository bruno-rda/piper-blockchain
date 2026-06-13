import { ec as EC } from 'elliptic'
import BN from 'bn.js'
import { sha256, ripemd160 } from 'hash.js'

const secp256k1 = new EC('secp256k1')
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


function b58encode(buffer: Uint8Array): string {
  let n = new BN(buffer)
  const result: string[] = []
  const base = new BN(58)
  while (n.gt(new BN(0))) {
    const { div, mod } = n.divmod(base)
    result.push(B58_ALPHABET[mod.toNumber()])
    n = div
  }
  for (const b of buffer) {
    if (b === 0) result.push(B58_ALPHABET[0])
    else break
  }
  return result.reverse().join('')
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(sha256().update(data).digest())
}

function ripemd160Bytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(ripemd160().update(data).digest())
}

export function generateKeyPair() {
  const key = secp256k1.genKeyPair()
  return {
    privateKey: key.getPrivate('hex'),
    publicKey: key.getPublic(true, 'hex'),
  }
}

export function deriveAddress(publicKeyHex: string): string {
  const pubBytes = hexToBytes(publicKeyHex)
  const shaHash = sha256Bytes(pubBytes)
  const ripeHash = ripemd160Bytes(shaHash)
  // Base58Check: version byte 0x00 + ripemd160 + 4-byte checksum
  const versioned = new Uint8Array([0x00, ...ripeHash])
  const checksum = sha256Bytes(sha256Bytes(versioned)).slice(0, 4)
  const payload = new Uint8Array([...versioned, ...checksum])
  return b58encode(payload)
}

export function signTransaction(privateKeyHex: string, txId: string): string {
  const key = secp256k1.keyFromPrivate(privateKeyHex, 'hex')
  const msgHash = sha256().update(txId).digest()
  const sig = key.sign(msgHash)
  return sig.toDER('hex')
}

export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  const key = secp256k1.keyFromPrivate(privateKeyHex, 'hex')
  return key.getPublic(true, 'hex')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function encryptPrivateKey(privateKeyHex: string, password: string) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any }, aesKey, hexToBytes(privateKeyHex) as any)

  return {
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
  }
}

export async function decryptPrivateKey(encrypted: { salt: string; iv: string; ciphertext: string }, password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = hexToBytes(encrypted.salt)
  const iv = hexToBytes(encrypted.iv)
  const ciphertext = hexToBytes(encrypted.ciphertext)

  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as any, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, aesKey, ciphertext as any)
  return bytesToHex(new Uint8Array(plaintext))
}

export function exportWIF(privateKeyHex: string): string {
  // WIF: 0x80 + private_key_bytes + 0x01 (compressed) + 4-byte checksum
  const privBytes = hexToBytes(privateKeyHex)
  const extended = new Uint8Array([0x80, ...privBytes, 0x01])
  const checksum = sha256Bytes(sha256Bytes(extended)).slice(0, 4)
  return b58encode(new Uint8Array([...extended, ...checksum]))
}