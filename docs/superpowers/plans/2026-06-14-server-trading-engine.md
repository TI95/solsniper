# Server-Side Trading Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Solana auto-trading engine out of the browser into a server-side worker process, with per-user custodial encrypted wallets, a Position/Trade data model, Start/Stop control, and server-side manual sell.

**Architecture:** Express API process (auth + wallet/bot/positions endpoints) and a SEPARATE worker process (`npm run worker`) share one MongoDB. The worker iterates users who have `botEnabled` and a wallet, discovers candidates via DexScreener, prices via Birdeye, buys/sells via Raydium or solanatracker (pumpswap), and persists positions and trades. Private keys are AES-256-GCM encrypted at rest; decrypted only in-worker memory at signing time.

**Tech Stack:** Node + Express 5 + TypeScript (CommonJS), Mongoose, `@solana/web3.js`, `@raydium-io/raydium-sdk-v2`, `@solana/spl-token`, axios, Node `crypto`. Tests: Vitest + `mongodb-memory-server`. Frontend: React + Vite + Redux Toolkit.

**Spec:** `docs/superpowers/specs/2026-06-14-server-trading-engine-design.md`

---

## File Structure

**Backend — new files:**
- `backend/src/config/trading-config.ts` — trading constants + filter thresholds.
- `backend/src/utils/crypto.ts` — AES-256-GCM encrypt/decrypt.
- `backend/src/utils/keypair.ts` — parse private key (byte-array or base58) → `Keypair`.
- `backend/src/models/wallet-model.ts` — encrypted wallet per user.
- `backend/src/models/position-model.ts` — open/closed positions (replaces `tokens-data-model` role).
- `backend/src/models/trade-model.ts` — closed trades + realized PnL.
- `backend/src/services/wallet-service.ts` — wallet CRUD + encryption.
- `backend/src/services/position-service.ts` — open/close positions, write trades.
- `backend/src/services/pnl.ts` — pure PnL math.
- `backend/src/services/birdeye-service.ts` — token + SOL price.
- `backend/src/services/dexscreener-service.ts` — boosted candidates + pair info.
- `backend/src/services/filter.ts` — pure candidate filter.
- `backend/src/controllers/wallet-controller.ts` — wallet + bot endpoints.
- `backend/src/controllers/trade-controller.ts` — manual sell + positions/trades reads.
- `backend/src/blockchain/connection.ts` — shared `Connection` + priority-fee helper.
- `backend/src/blockchain/raydium.ts` — buy/sell, takes `Keypair`.
- `backend/src/blockchain/pumpfun.ts` — buy/sell via solanatracker, takes `Keypair`.
- `backend/src/worker/index.ts` — worker entrypoint + main loop.
- `backend/src/worker/engine.ts` — per-user buy/sell orchestration.

**Backend — modified files:**
- `backend/package.json` — add deps + `worker`/`test` scripts.
- `backend/src/routes/index.ts` — register new routes.
- `backend/src/services/user-service.ts` — bcrypt rounds, remove password log.
- `backend/src/controllers/user-controller.ts` — unified cookie options, remove `/dashboard` stub.
- `backend/src/index.ts` — read cookie config; no functional trading change.

**Frontend — modified files:**
- `frontend/src/api/wallet-api.ts` (new) — wallet/bot/positions/trades/manual-sell client.
- `frontend/src/components/CreateNewWalletBtn.tsx` — paste-key form → backend.
- `frontend/src/components/BotControl.tsx` (new) — Start/Stop button.
- `frontend/src/components/ManualSellForm.tsx` — call backend instead of local blockchain.
- `frontend/src/pages/DashboardPage.tsx` — read `/positions` + `/trades`; drop `useAutoTrade`.
- Delete: `frontend/src/hooks/useAutoTrade.ts`, `frontend/src/blockchain/*` trading files, `VITE_PRIVATE_KEY` usage.

---

## Trading Constants (locked for this phase, from current code)

These go in `backend/src/config/trading-config.ts` (Task 4). Tunable later via Sub-project 4 UI.

- `BUY_AMOUNT_SOL = 0.015` (Raydium currently `15000000` lamports; pumpfun currently `0.001` — unified to 0.015 SOL).
- `SELL_FRACTION = 0.95` (sell 95% of holdings).
- `TAKE_PROFIT_MULT = 1.35` (sell at +35%).
- `STOP_LOSS_MULT = 0.70` (sell at -30%).
- `DUST_MULT = 0.10` (treat as dust/closed at -90%).
- `MAX_OPEN_POSITIONS = 1`.
- `BUY_COOLDOWN_SEC = 30`.
- `MAX_TOKEN_AGE_SEC = 60 * 25` (25 minutes).
- Filter: `MIN_LIQUIDITY_USD = 25000`, `MAX_MARKET_CAP_USD = 1300000`, `MIN_BOOSTS = 50`, `ALLOWED_DEXES = ['raydium', 'pumpswap']`, `CHAIN_ID = 'solana'`.

---

## Task 1: Backend test infrastructure (Vitest)

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/utils/__tests__/sanity.test.ts`

- [ ] **Step 1: Install dev dependencies**

Run (from `backend/`):
```bash
npm install -D vitest mongodb-memory-server bs58
```
Note: `bs58` is a runtime dep (base58 keypair parsing) — also install as a regular dep:
```bash
npm install bs58
```

- [ ] **Step 2: Add scripts to `backend/package.json`**

In `"scripts"`, add:
```json
"worker": "nodemon --watch src --exec ts-node src/worker/index.ts",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create sanity test `backend/src/utils/__tests__/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test**

Run (from `backend/`): `npm test`
Expected: PASS, 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/src/utils/__tests__/sanity.test.ts
git commit -m "test: add vitest + mongodb-memory-server to backend"
```

---

## Task 2: AES-256-GCM crypto utility

**Files:**
- Create: `backend/src/utils/crypto.ts`
- Test: `backend/src/utils/__tests__/crypto.test.ts`

- [ ] **Step 1: Write failing test `backend/src/utils/__tests__/crypto.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crypto`
Expected: FAIL — cannot find module `../crypto`.

- [ ] **Step 3: Implement `backend/src/utils/crypto.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crypto`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/crypto.ts backend/src/utils/__tests__/crypto.test.ts
git commit -m "feat: AES-256-GCM secret encryption utility"
```

---

## Task 3: Keypair parsing utility

**Files:**
- Create: `backend/src/utils/keypair.ts`
- Test: `backend/src/utils/__tests__/keypair.test.ts`

- [ ] **Step 1: Write failing test `backend/src/utils/__tests__/keypair.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- keypair`
Expected: FAIL — cannot find module `../keypair`.

- [ ] **Step 3: Implement `backend/src/utils/keypair.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- keypair`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/keypair.ts backend/src/utils/__tests__/keypair.test.ts
git commit -m "feat: keypair parsing (byte-array + base58)"
```

---

## Task 4: Trading config module

**Files:**
- Create: `backend/src/config/trading-config.ts`
- Test: `backend/src/config/__tests__/trading-config.test.ts`

- [ ] **Step 1: Write failing test `backend/src/config/__tests__/trading-config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { TRADING, FILTER } from '../trading-config';

describe('trading config', () => {
  it('exposes trade constants', () => {
    expect(TRADING.BUY_AMOUNT_SOL).toBe(0.015);
    expect(TRADING.TAKE_PROFIT_MULT).toBe(1.35);
    expect(TRADING.STOP_LOSS_MULT).toBe(0.70);
    expect(TRADING.MAX_OPEN_POSITIONS).toBe(1);
  });

  it('exposes filter constants', () => {
    expect(FILTER.MIN_LIQUIDITY_USD).toBe(25000);
    expect(FILTER.ALLOWED_DEXES).toContain('raydium');
    expect(FILTER.ALLOWED_DEXES).toContain('pumpswap');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- trading-config`
Expected: FAIL — cannot find module `../trading-config`.

- [ ] **Step 3: Implement `backend/src/config/trading-config.ts`**

```ts
export const TRADING = {
  BUY_AMOUNT_SOL: 0.015,
  SELL_FRACTION: 0.95,
  TAKE_PROFIT_MULT: 1.35,
  STOP_LOSS_MULT: 0.70,
  DUST_MULT: 0.10,
  MAX_OPEN_POSITIONS: 1,
  BUY_COOLDOWN_SEC: 30,
  MAX_TOKEN_AGE_SEC: 60 * 25,
} as const;

export const FILTER = {
  CHAIN_ID: 'solana',
  ALLOWED_DEXES: ['raydium', 'pumpswap'] as const,
  MIN_LIQUIDITY_USD: 25000,
  MAX_MARKET_CAP_USD: 1300000,
  MIN_BOOSTS: 50,
} as const;

export const WORKER = {
  LOOP_INTERVAL_MS: 5000, // sell/price check cadence
  CANDIDATE_REFRESH_MS: 60000, // candidate refresh cadence
} as const;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- trading-config`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/trading-config.ts backend/src/config/__tests__/trading-config.test.ts
git commit -m "feat: server-side trading + filter config"
```

---

## Task 5: Wallet model

**Files:**
- Create: `backend/src/models/wallet-model.ts`

- [ ] **Step 1: Implement `backend/src/models/wallet-model.ts`**

```ts
import { Schema, model, Types } from 'mongoose';

export interface Wallet {
  user: Types.ObjectId;
  publicKey: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;
  botEnabled: boolean;
  createdAt: Date;
}

const WalletSchema = new Schema<Wallet>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  publicKey: { type: String, required: true },
  encryptedSecret: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  botEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const WalletModel = model<Wallet>('Wallet', WalletSchema);
```

- [ ] **Step 2: Typecheck**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/wallet-model.ts
git commit -m "feat: Wallet model (encrypted, per user)"
```

---

## Task 6: Position model

**Files:**
- Create: `backend/src/models/position-model.ts`

- [ ] **Step 1: Implement `backend/src/models/position-model.ts`**

```ts
import { Schema, model, Types } from 'mongoose';

export type DexId = 'raydium' | 'pumpswap';
export type PositionStatus = 'open' | 'closed';

export interface Position {
  user: Types.ObjectId;
  tokenAddress: string;
  dexId: DexId;
  amount: number;       // normalized token amount
  amountRaw: number;    // raw (pre-decimals) amount
  decimals: number;
  buyPriceUSD: number;
  buyPriceSOL: number;
  totalCostUSD: number;
  txId: string;
  status: PositionStatus;
  openedAt: Date;
}

const PositionSchema = new Schema<Position>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenAddress: { type: String, required: true },
  dexId: { type: String, enum: ['raydium', 'pumpswap'], required: true },
  amount: { type: Number, required: true },
  amountRaw: { type: Number, required: true },
  decimals: { type: Number, required: true },
  buyPriceUSD: { type: Number, required: true },
  buyPriceSOL: { type: Number, required: true },
  totalCostUSD: { type: Number, required: true },
  txId: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  openedAt: { type: Date, default: Date.now },
});

PositionSchema.index({ user: 1, status: 1 });

export const PositionModel = model<Position>('Position', PositionSchema);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/position-model.ts
git commit -m "feat: Position model (open/closed positions)"
```

---

## Task 7: Trade model

**Files:**
- Create: `backend/src/models/trade-model.ts`

- [ ] **Step 1: Implement `backend/src/models/trade-model.ts`**

```ts
import { Schema, model, Types } from 'mongoose';
import { DexId } from './position-model';

export type TradeReason = 'take_profit' | 'stop_loss' | 'manual' | 'dust';

export interface Trade {
  user: Types.ObjectId;
  tokenAddress: string;
  dexId: DexId;
  buyPriceUSD: number;
  sellPriceUSD: number;
  amount: number;
  realizedPnlUSD: number;
  reason: TradeReason;
  txId: string;
  closedAt: Date;
}

const TradeSchema = new Schema<Trade>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenAddress: { type: String, required: true },
  dexId: { type: String, enum: ['raydium', 'pumpswap'], required: true },
  buyPriceUSD: { type: Number, required: true },
  sellPriceUSD: { type: Number, required: true },
  amount: { type: Number, required: true },
  realizedPnlUSD: { type: Number, required: true },
  reason: { type: String, enum: ['take_profit', 'stop_loss', 'manual', 'dust'], required: true },
  txId: { type: String, default: '' },
  closedAt: { type: Date, default: Date.now },
});

TradeSchema.index({ user: 1, closedAt: -1 });

export const TradeModel = model<Trade>('Trade', TradeSchema);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/trade-model.ts
git commit -m "feat: Trade model (closed trades + realized PnL)"
```

---

## Task 8: PnL math (pure)

**Files:**
- Create: `backend/src/services/pnl.ts`
- Test: `backend/src/services/__tests__/pnl.test.ts`

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/pnl.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { realizedPnlUSD } from '../pnl';

describe('realizedPnlUSD', () => {
  it('computes profit for amount sold', () => {
    // bought at $2, sold at $3, 10 tokens => $10 profit
    expect(realizedPnlUSD(2, 3, 10)).toBe(10);
  });

  it('computes loss', () => {
    expect(realizedPnlUSD(2, 1, 10)).toBe(-10);
  });

  it('zero amount => zero pnl', () => {
    expect(realizedPnlUSD(2, 3, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pnl`
Expected: FAIL — cannot find module `../pnl`.

- [ ] **Step 3: Implement `backend/src/services/pnl.ts`**

```ts
/** Realized PnL in USD for a closed (partial or full) position. */
export function realizedPnlUSD(buyPriceUSD: number, sellPriceUSD: number, amount: number): number {
  return (sellPriceUSD - buyPriceUSD) * amount;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pnl`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pnl.ts backend/src/services/__tests__/pnl.test.ts
git commit -m "feat: realized PnL math"
```

---

## Task 9: Candidate filter (pure)

**Files:**
- Create: `backend/src/services/filter.ts`
- Test: `backend/src/services/__tests__/filter.test.ts`

The shape of a candidate matches DexScreener `TokenPairProfile` (see `frontend/src/types/dex-screener-pair.ts`). We define a minimal local type with only the fields the filter needs.

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/filter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { passesFilter, dedupeByBaseToken, Candidate } from '../filter';

const now = Date.now();

function make(overrides: Partial<Candidate>): Candidate {
  return {
    chainId: 'solana',
    dexId: 'raydium',
    url: 'https://dexscreener.com/solana/x',
    baseToken: { address: 'TOKEN1', name: 'Tok' },
    liquidity: { usd: 50000 },
    marketCap: 500000,
    boosts: { active: 100 },
    pairCreatedAt: now - 60000, // 1 min ago (ms)
    ...overrides,
  };
}

describe('passesFilter', () => {
  it('passes a good candidate', () => {
    expect(passesFilter(make({}), now)).toBe(true);
  });

  it('rejects wrong chain', () => {
    expect(passesFilter(make({ chainId: 'ethereum' }), now)).toBe(false);
  });

  it('rejects disallowed dex', () => {
    expect(passesFilter(make({ dexId: 'orca' as any }), now)).toBe(false);
  });

  it('rejects low liquidity', () => {
    expect(passesFilter(make({ liquidity: { usd: 1000 } }), now)).toBe(false);
  });

  it('rejects high market cap', () => {
    expect(passesFilter(make({ marketCap: 99999999 }), now)).toBe(false);
  });

  it('rejects too few boosts', () => {
    expect(passesFilter(make({ boosts: { active: 1 } }), now)).toBe(false);
  });

  it('rejects too-old token', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 60 * 60 * 1000 }), now)).toBe(false);
  });
});

describe('dedupeByBaseToken', () => {
  it('keeps one per base token address', () => {
    const a = make({});
    const b = make({});
    const c = make({ baseToken: { address: 'TOKEN2', name: 'Other' } });
    expect(dedupeByBaseToken([a, b, c])).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- filter`
Expected: FAIL — cannot find module `../filter`.

- [ ] **Step 3: Implement `backend/src/services/filter.ts`**

```ts
import { FILTER, TRADING } from '../config/trading-config';
import { DexId } from '../models/position-model';

export interface Candidate {
  chainId: string;
  dexId: string;
  url: string;
  baseToken: { address: string; name: string };
  liquidity?: { usd?: number };
  marketCap: number;
  boosts: { active: number };
  pairCreatedAt: number; // ms epoch
}

export function passesFilter(c: Candidate, nowMs: number): boolean {
  const nowSec = Math.floor(nowMs / 1000);
  const minCreatedSec = nowSec - TRADING.MAX_TOKEN_AGE_SEC;
  const liquidityUsd = c.liquidity?.usd ?? 0;
  return (
    c.chainId === FILTER.CHAIN_ID &&
    (FILTER.ALLOWED_DEXES as readonly string[]).includes(c.dexId) &&
    liquidityUsd >= FILTER.MIN_LIQUIDITY_USD &&
    c.marketCap <= FILTER.MAX_MARKET_CAP_USD &&
    c.boosts.active >= FILTER.MIN_BOOSTS &&
    Math.floor(c.pairCreatedAt / 1000) >= minCreatedSec
  );
}

export function dedupeByBaseToken(candidates: Candidate[]): Candidate[] {
  const map = new Map<string, Candidate>();
  for (const c of candidates) {
    if (!map.has(c.baseToken.address)) map.set(c.baseToken.address, c);
  }
  return Array.from(map.values());
}

export function dexIdOf(c: Candidate): DexId {
  return c.dexId as DexId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- filter`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/filter.ts backend/src/services/__tests__/filter.test.ts
git commit -m "feat: pure candidate filter + dedupe"
```

---

## Task 10: Birdeye price service

**Files:**
- Create: `backend/src/services/birdeye-service.ts`
- Test: `backend/src/services/__tests__/birdeye-service.test.ts`

Env vars (server `.env`): `BIRDEYE_API_KEY`, `BIRDEYE_PRICE_API` (base URL ending so that `${BIRDEYE_PRICE_API}${mint}` is valid, e.g. `https://public-api.birdeye.so/defi/price?address=`).

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/birdeye-service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getTokenPrice, getSOLPrice } from '../birdeye-service';

vi.mock('axios');

describe('birdeye-service', () => {
  beforeEach(() => {
    process.env.BIRDEYE_API_KEY = 'k';
    process.env.BIRDEYE_PRICE_API = 'https://api.test/price?address=';
    vi.clearAllMocks();
  });

  it('returns value + priceInNative', async () => {
    (axios.get as any).mockResolvedValue({ data: { data: { value: 1.5, priceInNative: 0.01 } } });
    const r = await getTokenPrice('MINT');
    expect(r).toEqual({ value: 1.5, priceInNative: 0.01 });
  });

  it('returns zeros on error', async () => {
    (axios.get as any).mockRejectedValue(new Error('boom'));
    const r = await getTokenPrice('MINT');
    expect(r).toEqual({ value: 0, priceInNative: 0 });
  });

  it('getSOLPrice returns value', async () => {
    (axios.get as any).mockResolvedValue({ data: { data: { value: 210 } } });
    expect(await getSOLPrice()).toBe(210);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- birdeye`
Expected: FAIL — cannot find module `../birdeye-service`.

- [ ] **Step 3: Implement `backend/src/services/birdeye-service.ts`**

```ts
import axios from 'axios';
import { SOL_MINT } from '../config/trading-config';

function headers() {
  return {
    accept: 'application/json',
    'x-chain': 'solana',
    'X-API-KEY': process.env.BIRDEYE_API_KEY as string,
  };
}

export async function getTokenPrice(
  tokenAddress: string
): Promise<{ value: number; priceInNative: number }> {
  try {
    const url = `${process.env.BIRDEYE_PRICE_API}${tokenAddress}`;
    const res = await axios.get(url, { headers: headers() });
    const data = (res.data as { data: { value: number; priceInNative: number } }).data;
    return { value: data.value, priceInNative: data.priceInNative };
  } catch (e) {
    console.error('Birdeye price error:', e);
    return { value: 0, priceInNative: 0 };
  }
}

export async function getSOLPrice(): Promise<number> {
  try {
    const url = `${process.env.BIRDEYE_PRICE_API}${SOL_MINT}`;
    const res = await axios.get(url, { headers: headers() });
    return (res.data as { data: { value: number } }).data.value;
  } catch (e) {
    console.error('Birdeye SOL price error:', e);
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- birdeye`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/birdeye-service.ts backend/src/services/__tests__/birdeye-service.test.ts
git commit -m "feat: server-side Birdeye price service"
```

---

## Task 11: DexScreener candidate service

**Files:**
- Create: `backend/src/services/dexscreener-service.ts`
- Test: `backend/src/services/__tests__/dexscreener-service.test.ts`

Ports `frontend/src/api/boosted-tokens-api.ts` to the backend, returning `Candidate[]`.

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/dexscreener-service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchCandidates } from '../dexscreener-service';

vi.mock('axios');

describe('fetchCandidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flattens pair info for boosted tokens', async () => {
    (axios.get as any).mockImplementation((url: string) => {
      if (url.includes('/token-boosts/latest')) {
        return Promise.resolve({
          data: [{ chainId: 'solana', tokenAddress: 'T1', amount: 20 }],
        });
      }
      return Promise.resolve({
        data: [{ chainId: 'solana', dexId: 'raydium', baseToken: { address: 'T1', name: 'A' } }],
      });
    });
    const out = await fetchCandidates();
    expect(out).toHaveLength(1);
    expect(out[0].baseToken.address).toBe('T1');
  });

  it('returns [] when boosts response is not an array', async () => {
    (axios.get as any).mockResolvedValue({ data: { error: 'x' } });
    expect(await fetchCandidates()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dexscreener`
Expected: FAIL — cannot find module `../dexscreener-service`.

- [ ] **Step 3: Implement `backend/src/services/dexscreener-service.ts`**

```ts
import axios from 'axios';
import { Candidate } from './filter';

interface BoostedToken {
  chainId: string;
  tokenAddress: string;
  amount: number;
}

const BOOSTS_URL = 'https://api.dexscreener.com/token-boosts/latest/v1';
const PAIRS_URL = 'https://api.dexscreener.com/token-pairs/v1';

export async function fetchCandidates(): Promise<Candidate[]> {
  try {
    const res = await axios.get<BoostedToken[]>(BOOSTS_URL);
    if (!Array.isArray(res.data)) {
      console.error('Expected boosts array, got:', res.data);
      return [];
    }
    const boosted = res.data.filter((t) => t.amount >= 10 && t.chainId);
    const pairs = await Promise.all(
      boosted.map(async (t) => {
        try {
          const r = await axios.get<Candidate[]>(`${PAIRS_URL}/${t.chainId}/${t.tokenAddress}`);
          return r.data;
        } catch (e) {
          console.error(`Pair info error for ${t.tokenAddress}:`, e);
          return [] as Candidate[];
        }
      })
    );
    return pairs.flat();
  } catch (e) {
    console.error('fetchCandidates error:', e);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dexscreener`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/dexscreener-service.ts backend/src/services/__tests__/dexscreener-service.test.ts
git commit -m "feat: server-side DexScreener candidate service"
```

---

## Task 12: Shared Solana connection + priority fee helper

**Files:**
- Create: `backend/src/blockchain/connection.ts`

Env var (server `.env`): `QUICKNODE_ENDPOINT`.

- [ ] **Step 1: Implement `backend/src/blockchain/connection.ts`**

```ts
import { Connection } from '@solana/web3.js';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = process.env.QUICKNODE_ENDPOINT;
    if (!endpoint) throw new Error('QUICKNODE_ENDPOINT is not defined');
    _connection = new Connection(endpoint);
  }
  return _connection;
}

/** Raydium "very high" priority fee (lamports), used as the starting fee. */
export async function getRaydiumPriorityFee(): Promise<number> {
  const { data } = await axios.get<{
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
  return data.data.default.vh;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/blockchain/connection.ts
git commit -m "feat: shared Solana connection + priority fee helper"
```

---

## Task 13: Raydium buy/sell (server, parametrized by Keypair)

**Files:**
- Create: `backend/src/blockchain/raydium.ts`

This ports `frontend/src/blockchain/raydium-buy-token.ts` and `raydium-sell-token.ts`, replacing the module-level `owner` env keypair with an `owner: Keypair` parameter, and using `getConnection()`. Network calls are not unit-tested; validated by dry-run/manual.

- [ ] **Step 1: Implement `backend/src/blockchain/raydium.ts`**

```ts
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import axios from 'axios';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { getConnection, getRaydiumPriorityFee } from './connection';
import { SOL_MINT } from '../config/trading-config';

export interface RaydiumSwapCompute {
  id: string;
  success: boolean;
  data: { inputAmount: string; outputAmount: string };
}

export class LiquidErrorRaydium extends Error {
  constructor(public msg: string) {
    super(msg);
  }
}

async function buyToken(
  owner: Keypair,
  outputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number
): Promise<{ txId: string; swapResponse: RaydiumSwapCompute }> {
  const connection = getConnection();
  const inputMint = SOL_MINT;
  const txVersion = 'V0';

  const { data: swapResponse } = await axios.get<RaydiumSwapCompute>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  const { data: swapTransactions } = await axios.post<{
    data: { transaction: string }[];
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(priorityFee),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: true,
    unwrapSol: false,
  });

  if (!swapTransactions.data) throw new Error('Invalid response format');

  const txs = swapTransactions.data.map((tx) =>
    VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
  );

  let lastTxId = '';
  for (const transaction of txs) {
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId;
    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
      commitment: 'finalized',
    });
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature: txId }, 'confirmed');
  }
  return { txId: lastTxId, swapResponse };
}

async function sellToken(
  owner: Keypair,
  inputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number
): Promise<string> {
  const connection = getConnection();
  const outputMint = SOL_MINT;
  const txVersion = 'V0';

  const inputTokenAcc = await getAssociatedTokenAddress(new PublicKey(inputMint), owner.publicKey);
  const outputTokenAcc = await getAssociatedTokenAddress(new PublicKey(outputMint), owner.publicKey);

  const { data: swapResponse } = await axios.get<{
    id: string; success: boolean; version: string; msg?: string;
  }>(
    `${API_URLS.SWAP_HOST}/compute/swap-base-out?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}&txVersion=${txVersion}`
  );

  if (!swapResponse.success) {
    if (swapResponse.msg?.includes('INSUFFICIENT_LIQUIDITY')) {
      throw new LiquidErrorRaydium(swapResponse.msg);
    }
    throw new Error('swapResponse error: ' + swapResponse.msg);
  }

  const { data: swapTransactions } = await axios.post<{ data: { transaction: string }[] }>(
    `${API_URLS.SWAP_HOST}/transaction/swap-base-out`,
    {
      computeUnitPriceMicroLamports: String(priorityFee),
      swapResponse,
      txVersion,
      wallet: owner.publicKey.toBase58(),
      wrapSol: false,
      unwrapSol: true,
      inputAccount: inputTokenAcc.toBase58(),
      outputAccount: outputTokenAcc.toBase58(),
    }
  );

  if (!swapTransactions.data) throw new Error('Invalid response format');

  const txs = swapTransactions.data.map((tx) =>
    VersionedTransaction.deserialize(Buffer.from(tx.transaction, 'base64'))
  );

  let lastTxId = '';
  for (const transaction of txs) {
    transaction.sign([owner]);
    const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
    lastTxId = txId;
    const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature: txId }, 'confirmed');
  }
  if (!lastTxId) throw new Error('Failed to send transaction');
  return lastTxId;
}

async function txSucceeded(signature: string): Promise<boolean> {
  try {
    const res = await getConnection().getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!res) return false;
    return !res.meta?.err;
  } catch {
    return false;
  }
}

/** Buy `amountInLamports` worth of SOL into `tokenAddress`. Returns swap compute. */
export async function raydiumBuy(
  owner: Keypair,
  tokenAddress: string,
  amountInLamports: number
): Promise<RaydiumSwapCompute> {
  let priorityFee = await getRaydiumPriorityFee();
  let retry = 0;
  const MAX = 1;
  while (retry <= MAX) {
    try {
      const { txId, swapResponse } = await buyToken(owner, tokenAddress, amountInLamports, 10, priorityFee);
      if (await txSucceeded(txId)) return swapResponse;
      retry++;
    } catch (e) {
      if (e instanceof Error && e.message.includes('TransactionExpiredBlockheightExceededError')) {
        priorityFee = 2500000;
      }
      retry++;
    }
  }
  throw new Error('Raydium buy failed after retries');
}

/** Sell `amountInLamports` (SOL-out base) of `tokenAddress`. Returns txId. */
export async function raydiumSell(
  owner: Keypair,
  tokenAddress: string,
  amountInLamports: number
): Promise<string> {
  let priorityFee = await getRaydiumPriorityFee();
  let retry = 0;
  const MAX = 2;
  while (retry <= MAX) {
    try {
      const txId = await sellToken(owner, tokenAddress, amountInLamports, 10, priorityFee);
      if (await txSucceeded(txId)) return txId;
      retry++;
    } catch (e) {
      if (e instanceof LiquidErrorRaydium) throw e;
      if (e instanceof Error && e.message.includes('TransactionExpiredBlockheightExceededError')) {
        priorityFee = 2500000;
        retry++;
        continue;
      }
      retry++;
    }
  }
  throw new Error('Raydium sell failed after retries');
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/blockchain/raydium.ts
git commit -m "feat: server-side Raydium buy/sell (Keypair param)"
```

---

## Task 14: Pumpfun (solanatracker) buy/sell (server, parametrized by Keypair)

**Files:**
- Create: `backend/src/blockchain/pumpfun.ts`

Ports `frontend/src/blockchain/pumpfunswap-buy.ts`. `direction: 'buy'` spends SOL; `'sell'` spends tokens. Returns txId.

- [ ] **Step 1: Implement `backend/src/blockchain/pumpfun.ts`**

```ts
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { getConnection } from './connection';
import { SOL_MINT } from '../config/trading-config';

interface SwapResponse {
  txn: string;
  type: 'v0' | 'legacy';
}

const SWAP_API_URL = 'https://swap-v2.solanatracker.io/swap';

async function confirm(signature: string): Promise<void> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  const res = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (res?.meta?.err) throw new Error(`Transaction failed: ${JSON.stringify(res.meta.err)}`);
}

async function swap(
  owner: Keypair,
  outputMint: string,
  amount: number,
  slippage: number,
  priorityFee: number,
  inputMint: string
): Promise<string> {
  const connection = getConnection();
  const { data: swapResponse } = await axios.post<SwapResponse>(SWAP_API_URL, {
    from: inputMint,
    to: outputMint,
    amount,
    slippage,
    payer: owner.publicKey.toBase58(),
    priorityFee,
    feeType: 'add',
  });

  const serialized = Buffer.from(swapResponse.txn, 'base64');
  let txId: string;
  if (swapResponse.type === 'v0') {
    const transaction = VersionedTransaction.deserialize(serialized);
    transaction.sign([owner]);
    txId = await connection.sendTransaction(transaction, { skipPreflight: true });
  } else {
    const transaction = Transaction.from(serialized);
    transaction.sign(owner);
    txId = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
  }
  await confirm(txId);
  return txId;
}

/** Buy (spend `amount` SOL) or sell (spend `amount` tokens) via solanatracker. Returns txId. */
export async function pumpfunSwap(
  owner: Keypair,
  tokenAddress: string,
  amount: number,
  direction: 'buy' | 'sell',
  maxRetries = 3
): Promise<string> {
  let retry = 0;
  let priorityFee = 0.000005;
  while (retry < maxRetries) {
    try {
      const isBuy = direction === 'buy';
      const inputMint = isBuy ? SOL_MINT : tokenAddress;
      const outputMint = isBuy ? tokenAddress : SOL_MINT;
      return await swap(owner, outputMint, amount, 10, priorityFee, inputMint);
    } catch (e) {
      console.error(`pumpfun ${direction} attempt ${retry + 1} failed:`, e);
      priorityFee *= 2;
      retry++;
      if (retry >= maxRetries) throw new Error(`pumpfun ${direction} failed after ${maxRetries} attempts`);
    }
  }
  throw new Error('Unexpected error in pumpfunSwap');
}

export { PublicKey };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/blockchain/pumpfun.ts
git commit -m "feat: server-side pumpfun (solanatracker) swap (Keypair param)"
```

---

## Task 15: Wallet service (encryption + CRUD)

**Files:**
- Create: `backend/src/services/wallet-service.ts`
- Test: `backend/src/services/__tests__/wallet-service.test.ts`

Tests use `mongodb-memory-server`.

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/wallet-service.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import walletService from '../wallet-service';
import { WalletModel } from '../../models/wallet-model';

let mongod: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  process.env.WALLET_ENCRYPTION_KEY = '0'.repeat(64);
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await WalletModel.deleteMany({});
});

describe('wallet-service', () => {
  const kp = Keypair.generate();
  const secret = bs58.encode(kp.secretKey);

  it('saves an encrypted wallet and never stores plaintext', async () => {
    const saved = await walletService.saveWallet(userId, secret);
    expect(saved.publicKey).toBe(kp.publicKey.toBase58());
    const raw = await WalletModel.findOne({ user: userId });
    expect(raw!.encryptedSecret).not.toContain(secret);
  });

  it('getPublicView returns publicKey + botEnabled, never secret', async () => {
    await walletService.saveWallet(userId, secret);
    const view = await walletService.getPublicView(userId);
    expect(view).toEqual({ publicKey: kp.publicKey.toBase58(), botEnabled: false });
  });

  it('loadKeypair decrypts to the original keypair', async () => {
    await walletService.saveWallet(userId, secret);
    const loaded = await walletService.loadKeypair(userId);
    expect(loaded!.publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('setBotEnabled toggles flag', async () => {
    await walletService.saveWallet(userId, secret);
    await walletService.setBotEnabled(userId, true);
    expect((await walletService.getPublicView(userId))!.botEnabled).toBe(true);
  });

  it('rejects an invalid secret key', async () => {
    await expect(walletService.saveWallet(userId, 'garbage')).rejects.toThrow();
  });

  it('deleteWallet removes it', async () => {
    await walletService.saveWallet(userId, secret);
    await walletService.deleteWallet(userId);
    expect(await walletService.getPublicView(userId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- wallet-service`
Expected: FAIL — cannot find module `../wallet-service`.

- [ ] **Step 3: Implement `backend/src/services/wallet-service.ts`**

```ts
import { Keypair } from '@solana/web3.js';
import { WalletModel } from '../models/wallet-model';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { parseSecretKey, toStorableSecret } from '../utils/keypair';

class WalletService {
  async saveWallet(userId: string, rawSecret: string) {
    const kp = parseSecretKey(rawSecret); // throws on invalid
    const enc = encryptSecret(toStorableSecret(kp));
    const doc = await WalletModel.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        publicKey: kp.publicKey.toBase58(),
        encryptedSecret: enc.encryptedSecret,
        iv: enc.iv,
        authTag: enc.authTag,
      },
      { upsert: true, new: true }
    );
    return { publicKey: doc.publicKey };
  }

  async getPublicView(userId: string): Promise<{ publicKey: string; botEnabled: boolean } | null> {
    const doc = await WalletModel.findOne({ user: userId });
    if (!doc) return null;
    return { publicKey: doc.publicKey, botEnabled: doc.botEnabled };
  }

  async loadKeypair(userId: string): Promise<Keypair | null> {
    const doc = await WalletModel.findOne({ user: userId });
    if (!doc) return null;
    const secret = decryptSecret({
      encryptedSecret: doc.encryptedSecret,
      iv: doc.iv,
      authTag: doc.authTag,
    });
    return parseSecretKey(secret);
  }

  async setBotEnabled(userId: string, enabled: boolean) {
    await WalletModel.updateOne({ user: userId }, { botEnabled: enabled });
  }

  async deleteWallet(userId: string) {
    await WalletModel.deleteOne({ user: userId });
  }

  async listActiveWalletUserIds(): Promise<string[]> {
    const docs = await WalletModel.find({ botEnabled: true }).select('user');
    return docs.map((d) => d.user.toString());
  }
}

export default new WalletService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- wallet-service`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/wallet-service.ts backend/src/services/__tests__/wallet-service.test.ts
git commit -m "feat: wallet service (encrypt/CRUD/loadKeypair)"
```

---

## Task 16: Position service (open/close + write trade)

**Files:**
- Create: `backend/src/services/position-service.ts`
- Test: `backend/src/services/__tests__/position-service.test.ts`

- [ ] **Step 1: Write failing test `backend/src/services/__tests__/position-service.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import positionService from '../position-service';
import { PositionModel } from '../../models/position-model';
import { TradeModel } from '../../models/trade-model';

let mongod: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await PositionModel.deleteMany({});
  await TradeModel.deleteMany({});
});

const sample = {
  tokenAddress: 'TOKEN',
  dexId: 'raydium' as const,
  amount: 100,
  amountRaw: 100_000_000,
  decimals: 6,
  buyPriceUSD: 2,
  buyPriceSOL: 0.01,
  totalCostUSD: 200,
  txId: 'tx1',
};

describe('position-service', () => {
  it('opens a position', async () => {
    const p = await positionService.openPosition(userId, sample);
    expect(p.status).toBe('open');
    expect(await positionService.countOpen(userId)).toBe(1);
  });

  it('hasOpenForToken detects duplicates', async () => {
    await positionService.openPosition(userId, sample);
    expect(await positionService.hasOpenForToken(userId, 'TOKEN')).toBe(true);
    expect(await positionService.hasOpenForToken(userId, 'OTHER')).toBe(false);
  });

  it('closePosition writes a trade with realized pnl and marks closed', async () => {
    const p = await positionService.openPosition(userId, sample);
    const trade = await positionService.closePosition(p.id, 3, 'take_profit', 'tx2');
    expect(trade.realizedPnlUSD).toBe((3 - 2) * 100);
    expect(trade.reason).toBe('take_profit');
    const reloaded = await PositionModel.findById(p.id);
    expect(reloaded!.status).toBe('closed');
    expect(await positionService.countOpen(userId)).toBe(0);
  });

  it('getOpenPositions / getTrades read back', async () => {
    const p = await positionService.openPosition(userId, sample);
    await positionService.closePosition(p.id, 1, 'stop_loss', 'tx3');
    expect(await positionService.getOpenPositions(userId)).toHaveLength(0);
    expect(await positionService.getTrades(userId)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- position-service`
Expected: FAIL — cannot find module `../position-service`.

- [ ] **Step 3: Implement `backend/src/services/position-service.ts`**

```ts
import { PositionModel, Position, DexId } from '../models/position-model';
import { TradeModel, TradeReason } from '../models/trade-model';
import { realizedPnlUSD } from './pnl';

export interface OpenPositionInput {
  tokenAddress: string;
  dexId: DexId;
  amount: number;
  amountRaw: number;
  decimals: number;
  buyPriceUSD: number;
  buyPriceSOL: number;
  totalCostUSD: number;
  txId: string;
}

class PositionService {
  async openPosition(userId: string, input: OpenPositionInput) {
    return PositionModel.create({ ...input, user: userId, status: 'open' });
  }

  async countOpen(userId: string): Promise<number> {
    return PositionModel.countDocuments({ user: userId, status: 'open' });
  }

  async hasOpenForToken(userId: string, tokenAddress: string): Promise<boolean> {
    const n = await PositionModel.countDocuments({ user: userId, status: 'open', tokenAddress });
    return n > 0;
  }

  async getOpenPositions(userId: string): Promise<Position[]> {
    return PositionModel.find({ user: userId, status: 'open' });
  }

  async getTrades(userId: string) {
    return TradeModel.find({ user: userId }).sort({ closedAt: -1 });
  }

  /** Marks the position closed and records a Trade. `amount` sold == position.amount * SELL_FRACTION upstream. */
  async closePosition(positionId: string, sellPriceUSD: number, reason: TradeReason, txId: string) {
    const pos = await PositionModel.findById(positionId);
    if (!pos) throw new Error('Position not found');
    pos.status = 'closed';
    await pos.save();
    return TradeModel.create({
      user: pos.user,
      tokenAddress: pos.tokenAddress,
      dexId: pos.dexId,
      buyPriceUSD: pos.buyPriceUSD,
      sellPriceUSD,
      amount: pos.amount,
      realizedPnlUSD: realizedPnlUSD(pos.buyPriceUSD, sellPriceUSD, pos.amount),
      reason,
      txId,
    });
  }
}

export default new PositionService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- position-service`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/position-service.ts backend/src/services/__tests__/position-service.test.ts
git commit -m "feat: position service (open/close + trade record)"
```

---

## Task 17: Wallet + bot controller and routes

**Files:**
- Create: `backend/src/controllers/wallet-controller.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Implement `backend/src/controllers/wallet-controller.ts`**

```ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import walletService from '../services/wallet-service';

class WalletController {
  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { secretKey } = req.body;
      if (!secretKey || typeof secretKey !== 'string') {
        return next(ApiError.BadRequest('secretKey is required'));
      }
      try {
        const result = await walletService.saveWallet(userId, secretKey);
        return res.json(result);
      } catch {
        return next(ApiError.BadRequest('Invalid secret key'));
      }
    } catch (e) {
      next(e);
    }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      return res.json(view);
    } catch (e) {
      next(e);
    }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      await walletService.deleteWallet(userId);
      return res.json({ message: 'Wallet removed' });
    } catch (e) {
      next(e);
    }
  }

  async startBot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('Add a wallet before starting the bot'));
      await walletService.setBotEnabled(userId, true);
      return res.json({ botEnabled: true });
    } catch (e) {
      next(e);
    }
  }

  async stopBot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      await walletService.setBotEnabled(userId, false);
      return res.json({ botEnabled: false });
    } catch (e) {
      next(e);
    }
  }
}

export default new WalletController();
```

- [ ] **Step 2: Register routes in `backend/src/routes/index.ts`**

Add import at top:
```ts
import WalletController from '../controllers/wallet-controller';
```
Add routes before `export default router;`:
```ts
router.post('/wallet', authMiddleware, WalletController.save);
router.get('/wallet', authMiddleware, WalletController.get);
router.delete('/wallet', authMiddleware, WalletController.remove);
router.post('/bot/start', authMiddleware, WalletController.startBot);
router.post('/bot/stop', authMiddleware, WalletController.stopBot);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/wallet-controller.ts backend/src/routes/index.ts
git commit -m "feat: wallet + bot start/stop endpoints"
```

---

## Task 18: Trade controller (manual sell + positions/trades reads)

**Files:**
- Create: `backend/src/controllers/trade-controller.ts`
- Modify: `backend/src/routes/index.ts`

Manual sell loads the user's keypair, routes by platform, and (if a matching open position exists) closes it recording a `manual` trade at the current Birdeye price.

- [ ] **Step 1: Implement `backend/src/controllers/trade-controller.ts`**

```ts
import { Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import walletService from '../services/wallet-service';
import positionService from '../services/position-service';
import { raydiumSell } from '../blockchain/raydium';
import { pumpfunSwap } from '../blockchain/pumpfun';
import { getTokenPrice } from '../services/birdeye-service';
import { PositionModel } from '../models/position-model';

class TradeController {
  async manualSell(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());

      const { tokenAddress, amount, platform } = req.body as {
        tokenAddress?: string;
        amount?: number;
        platform?: 'raydium' | 'pumpfun';
      };
      if (!tokenAddress || !amount || !platform) {
        return next(ApiError.BadRequest('tokenAddress, amount and platform are required'));
      }

      const owner = await walletService.loadKeypair(userId);
      if (!owner) return next(ApiError.BadRequest('No wallet configured'));

      let txId = '';
      if (platform === 'raydium') {
        const lamports = Math.round(amount * 1_000_000_000);
        txId = await raydiumSell(owner, tokenAddress, lamports);
      } else {
        txId = await pumpfunSwap(owner, tokenAddress, Math.floor(amount), 'sell');
      }

      // Best-effort: close a matching open position recording a manual trade.
      const open = await PositionModel.findOne({ user: userId, status: 'open', tokenAddress });
      if (open) {
        const price = await getTokenPrice(tokenAddress);
        await positionService.closePosition(open.id, price.value, 'manual', txId);
      }

      return res.json({ message: 'Sell submitted', txId });
    } catch (e: any) {
      return next(ApiError.BadRequest(`Sell failed: ${e?.message || e}`));
    }
  }

  async positions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await positionService.getOpenPositions(userId));
    } catch (e) {
      next(e);
    }
  }

  async trades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await positionService.getTrades(userId));
    } catch (e) {
      next(e);
    }
  }
}

export default new TradeController();
```

- [ ] **Step 2: Register routes in `backend/src/routes/index.ts`**

Add import:
```ts
import TradeController from '../controllers/trade-controller';
```
Add routes:
```ts
router.post('/sell/manual', authMiddleware, TradeController.manualSell);
router.get('/positions', authMiddleware, TradeController.positions);
router.get('/trades', authMiddleware, TradeController.trades);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/trade-controller.ts backend/src/routes/index.ts
git commit -m "feat: manual sell + positions/trades read endpoints"
```

---

## Task 19: Engine orchestration (buy/sell decisions)

**Files:**
- Create: `backend/src/worker/engine.ts`
- Test: `backend/src/worker/__tests__/engine.test.ts`

The engine separates **decisions** (pure, testable) from **execution** (network). We unit-test the decision functions.

- [ ] **Step 1: Write failing test `backend/src/worker/__tests__/engine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sellDecision } from '../engine';
import { TRADING } from '../../config/trading-config';

describe('sellDecision', () => {
  const buy = 2;

  it('take_profit at +35% or more', () => {
    expect(sellDecision(buy, buy * TRADING.TAKE_PROFIT_MULT)).toBe('take_profit');
    expect(sellDecision(buy, buy * 2)).toBe('take_profit');
  });

  it('stop_loss at -30% or worse (but above dust)', () => {
    expect(sellDecision(buy, buy * TRADING.STOP_LOSS_MULT)).toBe('stop_loss');
  });

  it('dust at -90% or worse', () => {
    expect(sellDecision(buy, buy * TRADING.DUST_MULT)).toBe('dust');
    expect(sellDecision(buy, buy * 0.01)).toBe('dust');
  });

  it('hold in between', () => {
    expect(sellDecision(buy, buy)).toBe('hold');
    expect(sellDecision(buy, buy * 1.1)).toBe('hold');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- engine`
Expected: FAIL — cannot find module `../engine`.

- [ ] **Step 3: Implement `backend/src/worker/engine.ts`**

```ts
import { Keypair } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { TRADING } from '../config/trading-config';
import { fetchCandidates } from '../services/dexscreener-service';
import { passesFilter, dedupeByBaseToken, dexIdOf } from '../services/filter';
import { getTokenPrice, getSOLPrice } from '../services/birdeye-service';
import { getConnection } from '../blockchain/connection';
import { raydiumBuy, raydiumSell, LiquidErrorRaydium, RaydiumSwapCompute } from '../blockchain/raydium';
import { pumpfunSwap } from '../blockchain/pumpfun';
import positionService from '../services/position-service';
import walletService from '../services/wallet-service';
import { TradeReason } from '../models/trade-model';

export type SellAction = 'take_profit' | 'stop_loss' | 'dust' | 'hold';

/** Pure decision: given buy & current price, what to do. */
export function sellDecision(buyPriceUSD: number, currentPriceUSD: number): SellAction {
  if (currentPriceUSD <= buyPriceUSD * TRADING.DUST_MULT) return 'dust';
  if (currentPriceUSD >= buyPriceUSD * TRADING.TAKE_PROFIT_MULT) return 'take_profit';
  if (currentPriceUSD <= buyPriceUSD * TRADING.STOP_LOSS_MULT) return 'stop_loss';
  return 'hold';
}

async function getDecimals(tokenAddress: string): Promise<number> {
  const mint = await getMint(getConnection(), new PublicKey(tokenAddress));
  return mint.decimals;
}

/** Run one buy pass for a user (respects position cap + cooldown via lastBuyAt map). */
export async function runBuyPass(userId: string, owner: Keypair, lastBuyAt: { value: number }) {
  if ((await positionService.countOpen(userId)) >= TRADING.MAX_OPEN_POSITIONS) return;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - lastBuyAt.value < TRADING.BUY_COOLDOWN_SEC) return;

  const candidates = dedupeByBaseToken(await fetchCandidates()).filter((c) =>
    passesFilter(c, Date.now())
  );

  for (const c of candidates) {
    const tokenAddress = c.baseToken.address;
    if (await positionService.hasOpenForToken(userId, tokenAddress)) continue;
    if ((await positionService.countOpen(userId)) >= TRADING.MAX_OPEN_POSITIONS) break;

    const dexId = dexIdOf(c);
    try {
      const decimals = await getDecimals(tokenAddress);
      const solPrice = await getSOLPrice();
      let amountTokens: number;
      let amountRaw: number;
      let buyPriceUSD: number;
      let buyPriceSOL: number;
      let totalCostUSD: number;

      if (dexId === 'pumpswap') {
        await pumpfunSwap(owner, tokenAddress, TRADING.BUY_AMOUNT_SOL, 'buy');
        // pumpfun does not return amounts; price from Birdeye, amount approximated from cost
        const price = await getTokenPrice(tokenAddress);
        buyPriceUSD = price.value || 0;
        buyPriceSOL = price.priceInNative || 0;
        totalCostUSD = TRADING.BUY_AMOUNT_SOL * solPrice;
        amountTokens = buyPriceUSD > 0 ? totalCostUSD / buyPriceUSD : 0;
        amountRaw = Math.floor(amountTokens * Math.pow(10, decimals));
      } else {
        const lamports = Math.floor(TRADING.BUY_AMOUNT_SOL * 1e9);
        const resp: RaydiumSwapCompute = await raydiumBuy(owner, tokenAddress, lamports);
        const outputAmount = Number(resp.data.outputAmount) / 1e9;
        const inputAmount = Number(resp.data.inputAmount);
        amountTokens = outputAmount / Math.pow(10, decimals);
        amountRaw = outputAmount;
        buyPriceSOL = inputAmount / 1e9 / amountTokens;
        buyPriceUSD = buyPriceSOL * solPrice;
        totalCostUSD = (inputAmount / 1e9) * solPrice;
      }

      await positionService.openPosition(userId, {
        tokenAddress,
        dexId,
        amount: amountTokens,
        amountRaw,
        decimals,
        buyPriceUSD,
        buyPriceSOL,
        totalCostUSD,
        txId: 'buy',
      });
      lastBuyAt.value = nowSec;
      console.log(`✅ [${userId}] bought ${tokenAddress} @ $${buyPriceUSD} via ${dexId}`);
      break; // one buy per pass
    } catch (e) {
      console.error(`[${userId}] buy error for ${tokenAddress}:`, e);
    }
  }
}

function sellLamports(amountRaw: number, decimals: number, priceInNative: number): number {
  const raw = amountRaw * TRADING.SELL_FRACTION;
  const tokens = raw / Math.pow(10, decimals);
  return Math.floor(tokens * priceInNative * 1e9);
}

/** Run one sell/price pass over the user's open positions. */
export async function runSellPass(userId: string, owner: Keypair) {
  const positions = await positionService.getOpenPositions(userId);
  for (const pos of positions) {
    const price = await getTokenPrice(pos.tokenAddress);
    const action = sellDecision(pos.buyPriceUSD, price.value);
    if (action === 'hold') continue;

    if (action === 'dust') {
      await positionService.closePosition(pos.id, price.value, 'dust', '');
      continue;
    }

    try {
      let txId = '';
      if (pos.dexId === 'pumpswap') {
        txId = await pumpfunSwap(owner, pos.tokenAddress, Math.floor(pos.amount), 'sell');
      } else {
        const lamports = sellLamports(pos.amountRaw, pos.decimals, price.priceInNative);
        txId = await raydiumSell(owner, pos.tokenAddress, lamports);
      }
      await positionService.closePosition(pos.id, price.value, action as TradeReason, txId);
      console.log(`💸 [${userId}] sold ${pos.tokenAddress} (${action}) @ $${price.value}`);
    } catch (e) {
      if (e instanceof LiquidErrorRaydium) {
        await positionService.closePosition(pos.id, price.value, action as TradeReason, '');
        console.log(`[${userId}] ${pos.tokenAddress} closed on insufficient liquidity`);
      } else {
        console.error(`[${userId}] sell error for ${pos.tokenAddress}:`, e);
      }
    }
  }
}

export async function loadOwner(userId: string): Promise<Keypair | null> {
  return walletService.loadKeypair(userId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- engine`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/worker/engine.ts backend/src/worker/__tests__/engine.test.ts
git commit -m "feat: trading engine orchestration (buy/sell passes)"
```

---

## Task 20: Worker entrypoint (main loop)

**Files:**
- Create: `backend/src/worker/index.ts`

- [ ] **Step 1: Implement `backend/src/worker/index.ts`**

```ts
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { WORKER } from '../config/trading-config';
import walletService from '../services/wallet-service';
import { runBuyPass, runSellPass, loadOwner } from './engine';

dotenv.config();

// Per-user cooldown trackers (in-memory; resets on restart).
const lastBuyAt = new Map<string, { value: number }>();

async function tick() {
  let userIds: string[] = [];
  try {
    userIds = await walletService.listActiveWalletUserIds();
  } catch (e) {
    console.error('worker: failed to list active wallets:', e);
    return;
  }

  for (const userId of userIds) {
    try {
      const owner = await loadOwner(userId);
      if (!owner) continue;
      if (!lastBuyAt.has(userId)) lastBuyAt.set(userId, { value: 0 });
      await runSellPass(userId, owner);
      await runBuyPass(userId, owner, lastBuyAt.get(userId)!);
    } catch (e) {
      console.error(`worker: user ${userId} tick failed:`, e);
    }
  }
}

async function start() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) throw new Error('DB_URL is not defined in .env');
  if (!process.env.WALLET_ENCRYPTION_KEY) throw new Error('WALLET_ENCRYPTION_KEY is not defined');
  await mongoose.connect(dbUrl);
  console.log('worker: connected to MongoDB, starting loop');

  let running = false;
  setInterval(async () => {
    if (running) return; // prevent overlap
    running = true;
    try {
      await tick();
    } finally {
      running = false;
    }
  }, WORKER.LOOP_INTERVAL_MS);
}

start().catch((e) => {
  console.error('worker: fatal start error:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (no real trades expected without funded wallet)**

Run (from `backend/`, with `.env` containing `DB_URL`, `WALLET_ENCRYPTION_KEY`, `QUICKNODE_ENDPOINT`, `BIRDEYE_*`): `npm run worker`
Expected: logs `worker: connected to MongoDB, starting loop` and ticks without crashing. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add backend/src/worker/index.ts
git commit -m "feat: worker entrypoint + main loop"
```

---

## Task 21: Auth fixes (bcrypt rounds, log, cookies, dashboard stub)

**Files:**
- Modify: `backend/src/services/user-service.ts`
- Modify: `backend/src/controllers/user-controller.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Raise bcrypt rounds and remove password log in `backend/src/services/user-service.ts`**

Change line 16 from:
```ts
const hashPassword = await bcrypt.hash(password, 3);
```
to:
```ts
const hashPassword = await bcrypt.hash(password, 12);
```
In `login`, delete the line:
```ts
console.log(user);
```

- [ ] **Step 2: Add a shared cookie options helper in `backend/src/controllers/user-controller.ts`**

At the top of the file (after imports), add:
```ts
const REFRESH_COOKIE_OPTS = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};
```
Replace each `res.cookie('refreshToken', userData.refreshToken, { ... })` block in `registration`, `login`, and `refresh` with:
```ts
res.cookie('refreshToken', userData.refreshToken, REFRESH_COOKIE_OPTS);
```

- [ ] **Step 3: Remove the `/dashboard` stub**

In `backend/src/controllers/user-controller.ts`, delete the `getUsers` method.
In `backend/src/routes/index.ts`, delete the line:
```ts
router.get('/dashboard', authMiddleware, UserController.getUsers); // Protected route
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/user-service.ts backend/src/controllers/user-controller.ts backend/src/routes/index.ts
git commit -m "fix: bcrypt rounds=12, drop password log, unify cookies, remove dashboard stub"
```

---

## Task 22: Frontend wallet/bot/trade API client

**Files:**
- Modify: `frontend/src/api/axiosInstance.ts`
- Create: `frontend/src/api/wallet-api.ts`

The existing axios instance (`frontend/src/api/axiosInstance.ts`, default export `api`) only attaches the access token on 401-retry — initial requests go out with no `Authorization` header. We add a request interceptor that attaches `state.auth.accessToken` from the Redux store (the store is already wired via `setStore`). Without this, every new endpoint would need a 401 round-trip.

- [ ] **Step 1: Add a request interceptor in `frontend/src/api/axiosInstance.ts`**

Insert immediately AFTER the `const api = axios.create({ ... });` block (before the existing `api.interceptors.response.use(...)`):
```ts
api.interceptors.request.use((config) => {
  const token = store?.getState()?.auth?.accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

- [ ] **Step 2: Implement `frontend/src/api/wallet-api.ts`**

```ts
import api from './axiosInstance';

export interface WalletView {
  publicKey: string;
  botEnabled: boolean;
}

export const saveWallet = async (secretKey: string): Promise<{ publicKey: string }> => {
  const res = await api.post('/wallet', { secretKey });
  return res.data;
};

export const getWallet = async (): Promise<WalletView | null> => {
  const res = await api.get('/wallet');
  return res.data;
};

export const deleteWallet = async (): Promise<void> => {
  await api.delete('/wallet');
};

export const startBot = async (): Promise<{ botEnabled: boolean }> => {
  const res = await api.post('/bot/start');
  return res.data;
};

export const stopBot = async (): Promise<{ botEnabled: boolean }> => {
  const res = await api.post('/bot/stop');
  return res.data;
};

export const manualSell = async (
  tokenAddress: string,
  amount: number,
  platform: 'raydium' | 'pumpfun'
): Promise<{ txId: string }> => {
  const res = await api.post('/sell/manual', { tokenAddress, amount, platform });
  return res.data;
};

export interface PositionView {
  _id: string;
  tokenAddress: string;
  dexId: 'raydium' | 'pumpswap';
  amount: number;
  buyPriceUSD: number;
  totalCostUSD: number;
  openedAt: string;
}

export interface TradeView {
  _id: string;
  tokenAddress: string;
  buyPriceUSD: number;
  sellPriceUSD: number;
  realizedPnlUSD: number;
  reason: string;
  closedAt: string;
}

export const getPositions = async (): Promise<PositionView[]> => {
  const res = await api.get('/positions');
  return res.data;
};

export const getTrades = async (): Promise<TradeView[]> => {
  const res = await api.get('/trades');
  return res.data;
};
```

- [ ] **Step 3: Typecheck**

Run (from `frontend/`): `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/axiosInstance.ts frontend/src/api/wallet-api.ts
git commit -m "feat: frontend wallet/bot/trade API client + token request interceptor"
```

---

## Task 23: Wallet form (paste private key → backend)

**Files:**
- Modify: `frontend/src/components/CreateNewWalletBtn.tsx`

Replace the insecure key-display generator with a form that sends the pasted key to the backend and shows only the resulting public key.

- [ ] **Step 1: Replace the contents of `frontend/src/components/CreateNewWalletBtn.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { saveWallet, getWallet, deleteWallet } from '@/api/wallet-api';

export default function WalletGenerator() {
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setPublicKey(w?.publicKey ?? null))
      .catch(() => setPublicKey(null));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await saveWallet(secret.trim());
      setPublicKey(res.publicKey);
      setSecret(''); // never keep the secret in memory longer than needed
      setMessage('✅ Кошелёк сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteWallet();
      setPublicKey(null);
      setMessage('Кошелёк удалён');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Кошелёк для торговли</h2>
      {publicKey ? (
        <div className="mb-4">
          <p className="break-all"><b>Public Key:</b> {publicKey}</p>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg"
          >
            Удалить кошелёк
          </button>
        </div>
      ) : (
        <p className="mb-2 text-sm text-gray-600">Кошелёк не привязан.</p>
      )}

      <label className="block text-sm font-medium mb-1">
        Приватный ключ (массив байт через запятую или base58)
      </label>
      <textarea
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2"
        rows={3}
        placeholder="Вставьте приватный ключ"
      />
      <button
        onClick={handleSave}
        disabled={loading || !secret.trim()}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Сохранение...' : publicKey ? 'Заменить кошелёк' : 'Сохранить кошелёк'}
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CreateNewWalletBtn.tsx
git commit -m "feat: paste-key wallet form (sends to backend, shows only public key)"
```

---

## Task 24: Bot Start/Stop control

**Files:**
- Create: `frontend/src/components/BotControl.tsx`
- Modify: `frontend/src/pages/AccountSettingsPage.tsx`

- [ ] **Step 1: Implement `frontend/src/components/BotControl.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getWallet, startBot, stopBot } from '@/api/wallet-api';

export default function BotControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setEnabled(w?.botEnabled ?? false))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = enabled ? await stopBot() : await startBot();
      setEnabled(res.botEnabled);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) return <p className="p-4">Загрузка состояния бота...</p>;

  return (
    <div className="p-4">
      <p className="mb-2">Бот: <b>{enabled ? 'ВКЛ' : 'ВЫКЛ'}</b></p>
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-white ${enabled ? 'bg-red-600' : 'bg-green-600'}`}
      >
        {loading ? '...' : enabled ? 'Остановить бота' : 'Запустить бота'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add `BotControl` to `frontend/src/pages/AccountSettingsPage.tsx`**

Replace file contents with:
```tsx
import WalletGenerator from "@/components/CreateNewWalletBtn";
import BotControl from "@/components/BotControl";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

const AccountSettingsPage = () => {
    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletGenerator />
                <BotControl />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BotControl.tsx frontend/src/pages/AccountSettingsPage.tsx
git commit -m "feat: bot Start/Stop control in account settings"
```

---

## Task 25: Manual sell form → backend

**Files:**
- Modify: `frontend/src/components/ManualSellForm.tsx`

- [ ] **Step 1: Replace the imports and `handleSell` in `frontend/src/components/ManualSellForm.tsx`**

Remove these imports:
```tsx
import { apiSellToken } from '@/blockchain/raydium-sell-token';
import { apiPumpfunSwapToken } from '@/blockchain/pumpfunswap-buy';
import { PublicKey } from '@solana/web3.js';
```
Add this import:
```tsx
import { manualSell } from '@/api/wallet-api';
```
Replace the entire `handleSell` function body with:
```tsx
  const handleSell = async () => {
    setLoading(true);
    setResultMessage('');
    try {
      if (!tokenAddress) {
        setResultMessage('❌ Введите корректный адрес токена.');
        setLoading(false);
        return;
      }
      const numeric =
        platform === 'raydium' ? parseFloat(amount.replace(',', '.')) : parseInt(amount, 10);
      if (isNaN(numeric) || numeric <= 0) {
        setResultMessage(
          platform === 'raydium' ? '❌ Введите количество в SOL.' : '❌ Введите количество токенов.'
        );
        setLoading(false);
        return;
      }
      const res = await manualSell(tokenAddress, numeric, platform);
      setResultMessage(`✅ Продажа отправлена. txId: ${res.txId}`);
    } catch (error: any) {
      setResultMessage(`❌ Ошибка при продаже: ${error?.response?.data?.message || error.message || error}`);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors (the deleted blockchain files are addressed in Task 27; if tsc complains about other files importing them, proceed — Task 27 removes those imports).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ManualSellForm.tsx
git commit -m "feat: manual sell form calls backend /sell/manual"
```

---

## Task 26: Dashboard reads positions/trades from backend

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

Replace the `useAutoTrade`-driven dashboard with one that fetches positions and trades from the backend.

- [ ] **Step 1: Replace contents of `frontend/src/pages/DashboardPage.tsx`**

```tsx
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import ManualSellForm from "@/components/ManualSellForm";
import { getPositions, getTrades, PositionView, TradeView } from "@/api/wallet-api";
import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import 'react-loading-skeleton/dist/skeleton.css';

const Dashboard = () => {
    const [positions, setPositions] = useState<PositionView[] | null>(null);
    const [trades, setTrades] = useState<TradeView[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, t] = await Promise.all([getPositions(), getTrades()]);
                setPositions(p);
                setTrades(t);
            } catch (e) {
                console.error('Failed to load dashboard data:', e);
                setPositions([]);
            }
        };
        load();
        const id = setInterval(load, 10000);
        return () => clearInterval(id);
    }, []);

    if (positions === null) return <Skeleton count={10} />;

    return (
        <MaxWidthWrapper>
            <div className="mt-10">
                <h1 className="text-green-600 mb-4 font-bold">Открытые позиции</h1>
                {positions.length === 0 ? (
                    <p className="text-gray-500 mb-8">Открытых позиций нет.</p>
                ) : (
                    <ul className="mb-8">
                        {positions.map((p) => (
                            <li key={p._id} className="break-all mb-1">
                                {p.tokenAddress} — ${p.buyPriceUSD.toFixed(8)} ({p.dexId})
                            </li>
                        ))}
                    </ul>
                )}

                <h2 className="text-blue-500 text-xl mb-4">Закрытые сделки</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 text-sm mb-10">
                        <thead className="bg-gray-100 text-left">
                            <tr>
                                <th className="px-4 py-2 border-b">Token</th>
                                <th className="px-4 py-2 border-b text-green-600">Покупка ($)</th>
                                <th className="px-4 py-2 border-b text-red-600">Продажа ($)</th>
                                <th className="px-4 py-2 border-b">PnL ($)</th>
                                <th className="px-4 py-2 border-b">Причина</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border-b break-all">{t.tokenAddress}</td>
                                    <td className="px-4 py-2 border-b">${t.buyPriceUSD.toFixed(8)}</td>
                                    <td className="px-4 py-2 border-b">${t.sellPriceUSD.toFixed(8)}</td>
                                    <td className={`px-4 py-2 border-b font-semibold ${t.realizedPnlUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        ${t.realizedPnlUSD.toFixed(6)}
                                    </td>
                                    <td className="px-4 py-2 border-b">{t.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <ManualSellForm />
            </div>
        </MaxWidthWrapper>
    );
};

export default Dashboard;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors except possibly references to soon-deleted files (handled in Task 27).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: dashboard reads positions/trades from backend"
```

---

## Task 27: Remove client-side trading engine + private key

**Files:**
- Delete: `frontend/src/hooks/useAutoTrade.ts`
- Delete: `frontend/src/hooks/usePools.ts`
- Delete: `frontend/src/blockchain/raydium-buy-token.ts`
- Delete: `frontend/src/blockchain/raydium-sell-token.ts`
- Delete: `frontend/src/blockchain/pumpfunswap-buy.ts`
- Delete: `frontend/src/blockchain/test-for-pumpswap.ts`
- Delete: `frontend/src/blockchain/test-for-raydium.ts`
- Modify: any remaining file importing the above; remove `VITE_PRIVATE_KEY` from `.env`/`.env.example`.

- [ ] **Step 1: Verify nothing else imports the deleted modules**

Run (from repo root): search for remaining imports.
```bash
grep -rn "useAutoTrade\|usePools\|raydium-buy-token\|raydium-sell-token\|pumpfunswap-buy\|VITE_PRIVATE_KEY" frontend/src
```
Expected after Tasks 23–26: matches only inside the files being deleted in this task. If any other file references them, remove that usage first.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/src/hooks/useAutoTrade.ts frontend/src/hooks/usePools.ts \
  frontend/src/blockchain/raydium-buy-token.ts frontend/src/blockchain/raydium-sell-token.ts \
  frontend/src/blockchain/pumpfunswap-buy.ts frontend/src/blockchain/test-for-pumpswap.ts \
  frontend/src/blockchain/test-for-raydium.ts
```

- [ ] **Step 3: Remove `VITE_PRIVATE_KEY` from frontend env files**

Edit `frontend/.env` and `frontend/.env.example` (if present) to delete the `VITE_PRIVATE_KEY=...` line. The private key now lives only server-side, encrypted.

- [ ] **Step 4: Typecheck the frontend build**

Run (from `frontend/`): `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A frontend
git commit -m "chore: remove client-side trading engine and VITE_PRIVATE_KEY"
```

---

## Task 28: Backend env documentation + full test run

**Files:**
- Create/Modify: `backend/.env.example`

- [ ] **Step 1: Document required backend env vars in `backend/.env.example`**

```bash
# Existing
PORT=3000
DB_URL=mongodb://localhost:27017/solsniper
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
API_URL=http://localhost:3000
ACTIVATION_LINK_CLIENT_URL=http://localhost:5173/login
NODE_ENV=development

# New (server-side trading engine)
WALLET_ENCRYPTION_KEY=  # 64 hex chars (32 bytes). Generate: openssl rand -hex 32
QUICKNODE_ENDPOINT=     # Solana RPC endpoint
BIRDEYE_API_KEY=
BIRDEYE_PRICE_API=https://public-api.birdeye.so/defi/price?address=
```

- [ ] **Step 2: Run the full backend test suite**

Run (from `backend/`): `npm test`
Expected: all suites PASS (crypto, keypair, trading-config, pnl, filter, birdeye, dexscreener, wallet-service, position-service, engine, sanity).

- [ ] **Step 3: Typecheck both packages**

Run: `cd backend && npx tsc --noEmit` then `cd ../frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "docs: backend env vars for trading engine"
```

---

## Done Criteria

- API process and worker process run independently (`npm run dev`, `npm run worker`).
- A user can paste a private key in the profile; only the public key is ever returned/stored in plaintext-free form.
- Start/Stop toggles `botEnabled`; the worker trades only for enabled wallets.
- Buys/sells are routed by `dexId`, persisted as `Position`/`Trade`, with realized PnL.
- Manual sell works for both DEXes via the backend using the user's wallet.
- Dashboard shows open positions and closed trades from the backend.
- No private key remains in the frontend bundle.
- All backend unit/integration tests pass.
