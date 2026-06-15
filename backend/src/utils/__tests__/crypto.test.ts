import { describe, it, expect, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret } from '../crypto';

// 32-byte key as 64 hex chars
const TEST_KEY = '0'.repeat(64);

describe('crypto', () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  it('round-trips a secret', () => {
    const plain = 'super-secret-private-key';
    const enc = encryptSecret(plain);
    expect(enc.encryptedSecret).not.toContain(plain);
    expect(enc.iv).toBeTruthy();
    expect(enc.authTag).toBeTruthy();
    const dec = decryptSecret(enc);
    expect(dec).toBe(plain);
  });

  it('produces a different iv each call', () => {
    const a = encryptSecret('x');
    const b = encryptSecret('x');
    expect(a.iv).not.toBe(b.iv);
  });

  it('throws on tampered ciphertext', () => {
    const enc = encryptSecret('hello');
    const tampered = { ...enc, encryptedSecret: enc.encryptedSecret.slice(0, -2) + 'ff' };
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
