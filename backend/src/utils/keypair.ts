import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Accepts either a comma-separated byte array ("12,34,...") or a base58 string
 * (Phantom/Solflare export). Returns a validated Keypair. Throws on invalid input.
 */
export function parseSecretKey(input: string): Keypair {
  const trimmed = input.trim();
  let secret: Uint8Array;

  if (trimmed.includes(',')) {
    const bytes = trimmed.split(',').map((n) => Number(n.trim()));
    if (bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) {
      throw new Error('Invalid byte-array secret key');
    }
    secret = Uint8Array.from(bytes);
  } else {
    secret = bs58.decode(trimmed);
  }

  if (secret.length !== 64) {
    throw new Error('Secret key must be 64 bytes');
  }
  return Keypair.fromSecretKey(secret);
}

/** Canonical storable form: base58 of the 64-byte secret. */
export function toStorableSecret(kp: Keypair): string {
  return bs58.encode(kp.secretKey);
}
