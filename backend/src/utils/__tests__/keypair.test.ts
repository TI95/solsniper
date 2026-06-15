import { describe, it, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { parseSecretKey, toStorableSecret } from '../keypair';

describe('keypair parsing', () => {
  const kp = Keypair.generate();
  const byteArrayStr = kp.secretKey.join(',');
  const base58Str = bs58.encode(kp.secretKey);

  it('parses comma-separated byte array', () => {
    const parsed = parseSecretKey(byteArrayStr);
    expect(parsed.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('parses base58 string', () => {
    const parsed = parseSecretKey(base58Str);
    expect(parsed.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('throws on garbage', () => {
    expect(() => parseSecretKey('not-a-key')).toThrow();
  });

  it('toStorableSecret round-trips through parseSecretKey', () => {
    const stored = toStorableSecret(kp);
    const parsed = parseSecretKey(stored);
    expect(parsed.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });
});
