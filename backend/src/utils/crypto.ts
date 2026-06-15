import crypto from 'crypto';

export interface EncryptedPayload {
  encryptedSecret: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedSecret: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedSecret, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
