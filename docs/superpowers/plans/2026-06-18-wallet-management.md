# Wallet Management UI (Sub-project 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full custodial wallet management to the profile — server-side wallet generation, SOL balance display, SOL withdrawal to an external address, and private-key export — with the two money-moving operations (withdraw, export) gated behind account-password re-auth.

**Architecture:** Extend the existing backend wallet layer. A new isolated `blockchain/transfer.ts` does the on-chain SOL transfer so `wallet-service` can be unit-tested with it mocked. A shared `userService.verifyPassword` helper does the bcrypt re-auth. Four new authenticated routes (`/wallet/generate`, `/wallet/balance`, `/wallet/withdraw`, `/wallet/export`) scoped strictly by `req.user.id`. The frontend replaces the single `CreateNewWalletBtn` with a `WalletPanel` (generate/import/balance/delete) plus `WithdrawForm` and `ExportKeyDialog`, all on `AccountSettingsPage`.

**Tech Stack:** Express 5 + TypeScript + MongoDB (Mongoose), `@solana/web3.js`, `bcrypt`, AES-256-GCM (existing `utils/crypto`); React + Vite + Tailwind on the frontend. Tests: vitest + mongodb-memory-server + supertest.

---

## ⚠️ Working-tree caveat (read before Task 1)

`backend/src/services/user-service.ts` currently carries an **intentional, uncommitted, dev-only local change**: the `if (process.env.NODE_ENV === 'development')` block inside `registration()` that auto-activates the account and skips the activation email. **This must never be committed.** Task 1 modifies this same file, so it uses a `git stash` dance (stash the file → edit the clean version → commit → pop) to commit *only* `verifyPassword` while preserving the local dev bypass. No other task touches `user-service.ts`.

**Every commit in this plan stages explicit paths only — never `git add -A` or `git add .`** (the dev bypass above and the untracked `frontend/src/assets/image.png` must stay unstaged).

---

## File Structure

**Backend — new:**
- `backend/src/blockchain/transfer.ts` — `transferSol(from, to, lamports)`: builds and sends a `SystemProgram.transfer`, returns the signature. Isolated for mockability.
- `backend/src/services/__tests__/user-service.test.ts` — unit tests for `verifyPassword`.
- `backend/src/controllers/__tests__/wallet.integration.test.ts` — HTTP + IDOR tests for the 4 new endpoints.

**Backend — modified:**
- `backend/src/services/user-service.ts` — add `verifyPassword`.
- `backend/src/services/wallet-service.ts` — add `generateWallet`, `getBalanceLamports`, `exportSecret`, `withdraw`.
- `backend/src/services/__tests__/wallet-service.test.ts` — add unit tests for the new service methods.
- `backend/src/controllers/wallet-controller.ts` — add `generate`, `balance`, `withdraw`, `exportSecret` handlers.
- `backend/src/routes/index.ts` — add 4 routes.
- `backend/src/config/trading-config.ts` — add `WITHDRAW_FEE_BUFFER_LAMPORTS`.

**Frontend — new:**
- `frontend/src/components/WalletPanel.tsx` — public key + balance + generate + import + delete.
- `frontend/src/components/WithdrawForm.tsx` — destination + amount (+ Max) + password → withdraw.
- `frontend/src/components/ExportKeyDialog.tsx` — password → reveal secret once.

**Frontend — modified:**
- `frontend/src/api/wallet-api.ts` — add `generateWallet`, `getBalance`, `withdrawSol`, `exportSecret`.
- `frontend/src/pages/AccountSettingsPage.tsx` — render the new components instead of `WalletGenerator`.

**Frontend — deleted:**
- `frontend/src/components/CreateNewWalletBtn.tsx`.

---

## Task 1: `verifyPassword` re-auth helper

**Files:**
- Modify: `backend/src/services/user-service.ts`
- Test: `backend/src/services/__tests__/user-service.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/__tests__/user-service.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import userService from '../user-service';
import { UserModel } from '../../models/user-model';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
});

describe('user-service.verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const password = 'correct-horse-battery';
    const user = await UserModel.create({
      email: 'a@e.com',
      password: await bcrypt.hash(password, 12),
      isActivated: true,
    });
    expect(await userService.verifyPassword(user._id.toString(), password)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const user = await UserModel.create({
      email: 'a@e.com',
      password: await bcrypt.hash('correct-horse-battery', 12),
      isActivated: true,
    });
    expect(await userService.verifyPassword(user._id.toString(), 'wrong')).toBe(false);
  });

  it('returns false for a non-existent user', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    expect(await userService.verifyPassword(id, 'whatever')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/__tests__/user-service.test.ts`
Expected: FAIL — `userService.verifyPassword is not a function`.

- [ ] **Step 3: Set aside the local dev bypass before editing**

The working tree change in `user-service.ts` (the dev-only auto-activate block) must not be committed. Stash just this file so you edit the committed version:

```bash
cd backend && git stash push -- src/services/user-service.ts
```

(Working tree now shows `user-service.ts` without the dev bypass.)

- [ ] **Step 4: Write minimal implementation**

In `backend/src/services/user-service.ts`, add this method to the `UserService` class (e.g. right after `login`):

```ts
  /** Re-auth helper: true iff `password` matches the user's stored hash. Never logs the password. */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await UserModel.findById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }
```

(`UserModel` and `bcrypt` are already imported at the top of the file.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/__tests__/user-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit, then restore the local dev bypass**

```bash
cd backend && git add src/services/user-service.ts src/services/__tests__/user-service.test.ts
git commit -m "feat(wallet): add userService.verifyPassword re-auth helper"
git stash pop
```

`git stash pop` re-applies the dev bypass (it lives in `registration()`, a different region than the new method, so it applies cleanly). Confirm with `git status` that `user-service.ts` is once again "modified" (unstaged) and `git diff src/services/user-service.ts` shows only the `NODE_ENV === 'development'` block.

---

## Task 2: `transferSol` blockchain helper

**Files:**
- Create: `backend/src/blockchain/transfer.ts`

This is a thin wrapper over `@solana/web3.js` RPC calls. Per the spec it is deliberately isolated so `wallet-service` can be unit-tested with it mocked — it has **no dedicated unit test** (a real test would need a funded wallet + live RPC). It is exercised indirectly by the withdraw service tests (which mock it) and by manual e2e.

- [ ] **Step 1: Write the implementation**

Create `backend/src/blockchain/transfer.ts`:

```ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { getConnection } from './connection';

/**
 * Transfers `lamports` SOL from `from` to `to` and waits for confirmation.
 * Isolated from wallet-service so the service can be unit-tested with this mocked.
 * Returns the transaction signature.
 */
export async function transferSol(
  from: Keypair,
  to: PublicKey,
  lamports: number
): Promise<string> {
  const connection: Connection = getConnection();
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports,
    })
  );
  return sendAndConfirmTransaction(connection, tx, [from]);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/blockchain/transfer.ts
git commit -m "feat(wallet): transferSol blockchain helper"
```

---

## Task 3: `generateWallet` + `exportSecret` service methods

**Files:**
- Modify: `backend/src/services/wallet-service.ts`
- Test: `backend/src/services/__tests__/wallet-service.test.ts`

- [ ] **Step 1: Write the failing tests**

In `backend/src/services/__tests__/wallet-service.test.ts`, add this import near the existing imports (the test file does not yet import from keypair):

```ts
import { parseSecretKey } from '../../utils/keypair';
```

Then add these tests inside the `describe('wallet-service', ...)` block:

```ts
  it('generateWallet stores an encrypted wallet whose pubkey matches the secret', async () => {
    const { publicKey } = await walletService.generateWallet(userId);
    const exported = await walletService.exportSecret(userId);
    expect(parseSecretKey(exported).publicKey.toBase58()).toBe(publicKey);
    const raw = await WalletModel.findOne({ user: userId });
    expect(raw!.encryptedSecret).not.toContain(exported);
  });

  it('exportSecret round-trips a saved wallet to the same pubkey', async () => {
    await walletService.saveWallet(userId, secret);
    const exported = await walletService.exportSecret(userId);
    expect(parseSecretKey(exported).publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('exportSecret throws when no wallet exists', async () => {
    await expect(walletService.exportSecret(userId)).rejects.toThrow();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/__tests__/wallet-service.test.ts`
Expected: FAIL — `walletService.generateWallet is not a function` / `walletService.exportSecret is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/services/wallet-service.ts`, add these two methods to the `WalletService` class (after `loadKeypair`):

```ts
  async generateWallet(userId: string) {
    const kp = Keypair.generate();
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

  async exportSecret(userId: string): Promise<string> {
    const doc = await WalletModel.findOne({ user: userId });
    if (!doc) throw new Error('No wallet to export');
    return decryptSecret({
      encryptedSecret: doc.encryptedSecret,
      iv: doc.iv,
      authTag: doc.authTag,
    });
  }
```

(`Keypair`, `encryptSecret`, `decryptSecret`, `toStorableSecret`, `WalletModel` are all already imported in this file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/__tests__/wallet-service.test.ts`
Expected: PASS (existing 6 + 3 new = 9 tests).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/services/wallet-service.ts src/services/__tests__/wallet-service.test.ts
git commit -m "feat(wallet): generateWallet + exportSecret service methods"
```

---

## Task 4: `getBalanceLamports` + `withdraw` service methods + fee buffer config

**Files:**
- Modify: `backend/src/config/trading-config.ts`
- Modify: `backend/src/services/wallet-service.ts`
- Test: `backend/src/services/__tests__/wallet-service.test.ts`

- [ ] **Step 1: Add the fee-buffer config constant**

In `backend/src/config/trading-config.ts`, add a top-level export (after `SOL_MINT`):

```ts
/** Lamports kept in the wallet on a "Max" withdraw so the network fee can be paid. */
export const WITHDRAW_FEE_BUFFER_LAMPORTS = 10000;
```

- [ ] **Step 2: Write the failing tests**

In `backend/src/services/__tests__/wallet-service.test.ts`:

(a) Add `vi` to the vitest import and `PublicKey` to the web3 import. Change the first two import lines to:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
```
```ts
import { Keypair, PublicKey } from '@solana/web3.js';
```

(b) Add these mocks and imports near the top of the file, after the existing imports:

```ts
vi.mock('../../blockchain/connection', () => ({ getConnection: vi.fn() }));
vi.mock('../../blockchain/transfer', () => ({ transferSol: vi.fn() }));
import { getConnection } from '../../blockchain/connection';
import { transferSol } from '../../blockchain/transfer';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../../config/trading-config';
```

(c) Update the existing `beforeEach` to also reset mocks. Change it to:

```ts
beforeEach(async () => {
  await WalletModel.deleteMany({});
  vi.clearAllMocks();
});
```

(d) Add these tests inside the `describe('wallet-service', ...)` block:

```ts
  const destKp = Keypair.generate();
  const destination = destKp.publicKey.toBase58();

  it('getBalanceLamports reads on-chain balance for the stored pubkey', async () => {
    await walletService.saveWallet(userId, secret);
    const getBalance = vi.fn().mockResolvedValue(2_000_000_000);
    (getConnection as any).mockReturnValue({ getBalance });
    const lamports = await walletService.getBalanceLamports(userId);
    expect(lamports).toBe(2_000_000_000);
    expect((getBalance.mock.calls[0][0] as PublicKey).toBase58()).toBe(kp.publicKey.toBase58());
  });

  it('getBalanceLamports throws when no wallet exists', async () => {
    await expect(walletService.getBalanceLamports(userId)).rejects.toThrow();
  });

  it('withdraw transfers lamports and returns the tx signature', async () => {
    await walletService.saveWallet(userId, secret);
    (getConnection as any).mockReturnValue({ getBalance: vi.fn().mockResolvedValue(1_000_000_000) });
    (transferSol as any).mockResolvedValue('SIG123');
    const sig = await walletService.withdraw(userId, destination, 500_000_000);
    expect(sig).toBe('SIG123');
    expect(transferSol).toHaveBeenCalledTimes(1);
  });

  it('withdraw rejects an invalid destination address', async () => {
    await walletService.saveWallet(userId, secret);
    (getConnection as any).mockReturnValue({ getBalance: vi.fn().mockResolvedValue(1_000_000_000) });
    await expect(walletService.withdraw(userId, 'not-an-address', 1_000)).rejects.toThrow();
    expect(transferSol).not.toHaveBeenCalled();
  });

  it('withdraw rejects a non-positive amount', async () => {
    await walletService.saveWallet(userId, secret);
    (getConnection as any).mockReturnValue({ getBalance: vi.fn().mockResolvedValue(1_000_000_000) });
    await expect(walletService.withdraw(userId, destination, 0)).rejects.toThrow();
    expect(transferSol).not.toHaveBeenCalled();
  });

  it('withdraw rejects an amount above balance minus the fee buffer', async () => {
    await walletService.saveWallet(userId, secret);
    (getConnection as any).mockReturnValue({ getBalance: vi.fn().mockResolvedValue(1_000_000) });
    await expect(
      walletService.withdraw(userId, destination, 1_000_000 - WITHDRAW_FEE_BUFFER_LAMPORTS + 1)
    ).rejects.toThrow();
    expect(transferSol).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/__tests__/wallet-service.test.ts`
Expected: FAIL — `walletService.getBalanceLamports is not a function` / `walletService.withdraw is not a function`.

- [ ] **Step 4: Write minimal implementation**

In `backend/src/services/wallet-service.ts`, add these imports at the top (extend the existing web3 import and add two new ones):

```ts
import { Keypair, PublicKey } from '@solana/web3.js';
import { getConnection } from '../blockchain/connection';
import { transferSol } from '../blockchain/transfer';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../config/trading-config';
```

(The existing first line is `import { Keypair } from '@solana/web3.js';` — replace it with the `Keypair, PublicKey` form above; add the other three as new lines.)

Add these two methods to the `WalletService` class (after `exportSecret`):

```ts
  async getBalanceLamports(userId: string): Promise<number> {
    const doc = await WalletModel.findOne({ user: userId });
    if (!doc) throw new Error('No wallet');
    return getConnection().getBalance(new PublicKey(doc.publicKey));
  }

  async withdraw(userId: string, destination: string, lamports: number): Promise<string> {
    const kp = await this.loadKeypair(userId);
    if (!kp) throw new Error('No wallet');

    let dest: PublicKey;
    try {
      dest = new PublicKey(destination);
    } catch {
      throw new Error('Invalid destination address');
    }
    if (dest.equals(kp.publicKey)) {
      throw new Error('Destination must differ from the wallet address');
    }
    if (!Number.isFinite(lamports) || lamports <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    const balance = await getConnection().getBalance(kp.publicKey);
    if (lamports > balance - WITHDRAW_FEE_BUFFER_LAMPORTS) {
      throw new Error('Amount exceeds available balance');
    }
    return transferSol(kp, dest, lamports);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/__tests__/wallet-service.test.ts`
Expected: PASS (9 + 5 new = 14 tests).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/config/trading-config.ts src/services/wallet-service.ts src/services/__tests__/wallet-service.test.ts
git commit -m "feat(wallet): getBalanceLamports + withdraw service methods with fee buffer"
```

---

## Task 5: Controller handlers + routes

**Files:**
- Modify: `backend/src/controllers/wallet-controller.ts`
- Modify: `backend/src/routes/index.ts`

(No standalone unit test — the controllers are exercised by the HTTP integration tests in Task 6, which is the next task. This task ends at a typecheck + commit.)

- [ ] **Step 1: Add imports to the controller**

In `backend/src/controllers/wallet-controller.ts`, add after the existing imports:

```ts
import userService from '../services/user-service';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../config/trading-config';
```

- [ ] **Step 2: Add the four handlers**

Add these methods to the `WalletController` class (e.g. after `stopBot`):

```ts
  async generate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const result = await walletService.generateWallet(userId);
      return res.json(result);
    } catch (e) {
      next(e);
    }
  }

  async balance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('No wallet'));
      const lamports = await walletService.getBalanceLamports(userId);
      return res.json({ lamports, sol: lamports / 1e9 });
    } catch (e) {
      next(e);
    }
  }

  async withdraw(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { password, destination, amountSol, max } = req.body;
      if (!password || typeof password !== 'string') {
        return next(ApiError.BadRequest('password is required'));
      }
      if (!destination || typeof destination !== 'string') {
        return next(ApiError.BadRequest('destination is required'));
      }
      if (!max && !(typeof amountSol === 'number' && amountSol > 0)) {
        return next(ApiError.BadRequest('amountSol must be greater than 0'));
      }
      if (!(await userService.verifyPassword(userId, password))) {
        return next(ApiError.BadRequest('Invalid password'));
      }
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('No wallet'));

      let lamports: number;
      if (max) {
        const balance = await walletService.getBalanceLamports(userId);
        lamports = balance - WITHDRAW_FEE_BUFFER_LAMPORTS;
      } else {
        lamports = Math.round(amountSol * 1e9);
      }

      try {
        const txId = await walletService.withdraw(userId, destination, lamports);
        return res.json({ txId });
      } catch (e: any) {
        // Validation (bad address / amount) and RPC failures both surface as a
        // readable 400 so the frontend can show the message without breaking.
        return next(ApiError.BadRequest(e?.message || 'Withdraw failed'));
      }
    } catch (e) {
      next(e);
    }
  }

  async exportSecret(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        return next(ApiError.BadRequest('password is required'));
      }
      if (!(await userService.verifyPassword(userId, password))) {
        return next(ApiError.BadRequest('Invalid password'));
      }
      try {
        const secretKey = await walletService.exportSecret(userId);
        return res.json({ secretKey });
      } catch {
        return next(ApiError.BadRequest('No wallet to export'));
      }
    } catch (e) {
      next(e);
    }
  }
```

- [ ] **Step 3: Add the routes**

In `backend/src/routes/index.ts`, add after the existing `/bot/stop` route (line ~51):

```ts
router.post('/wallet/generate', authMiddleware, WalletController.generate);
router.get('/wallet/balance', authMiddleware, WalletController.balance);
router.post('/wallet/withdraw', authMiddleware, WalletController.withdraw);
router.post('/wallet/export', authMiddleware, WalletController.exportSecret);
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/controllers/wallet-controller.ts src/routes/index.ts
git commit -m "feat(wallet): generate/balance/withdraw/export controllers + routes"
```

---

## Task 6: HTTP integration + IDOR tests

**Files:**
- Test: `backend/src/controllers/__tests__/wallet.integration.test.ts` (create)

`getConnection` and `transferSol` are mocked at the top of the file so withdraw/balance don't hit a live RPC. Closes the long-standing "no IDOR tests for wallet endpoints" follow-up.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/controllers/__tests__/wallet.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { parseSecretKey } from '../../utils/keypair';

vi.mock('../../blockchain/connection', () => ({
  getConnection: vi.fn(() => ({ getBalance: vi.fn().mockResolvedValue(2_000_000_000) })),
}));
vi.mock('../../blockchain/transfer', () => ({
  transferSol: vi.fn().mockResolvedValue('SIG_OK'),
}));

import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { WalletModel } from '../../models/wallet-model';

let mongod: MongoMemoryServer;
const DEST = 'So11111111111111111111111111111111111111112'; // valid 32-byte base58 pubkey (wrapped SOL mint)

async function makeUser(email: string, password = 'pw-secret-123') {
  const user = await UserModel.create({
    email,
    password: await bcrypt.hash(password, 12),
    isActivated: true,
  });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken, password };
}

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
  await UserModel.deleteMany({});
  await WalletModel.deleteMany({});
});

describe('wallet management endpoints', () => {
  it('rejects unauthenticated requests on all four endpoints', async () => {
    expect((await request(app).post('/api/wallet/generate')).status).toBe(401);
    expect((await request(app).get('/api/wallet/balance')).status).toBe(401);
    expect((await request(app).post('/api/wallet/withdraw').send({})).status).toBe(401);
    expect((await request(app).post('/api/wallet/export').send({})).status).toBe(401);
  });

  it('generate creates a wallet and GET /wallet shows its public key', async () => {
    const a = await makeUser('a@e.com');
    const gen = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    expect(gen.status).toBe(200);
    expect(typeof gen.body.publicKey).toBe('string');

    const view = await request(app).get('/api/wallet').set('Authorization', `Bearer ${a.token}`);
    expect(view.body.publicKey).toBe(gen.body.publicKey);
  });

  it('balance returns sol for the stored wallet', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lamports: 2_000_000_000, sol: 2 });
  });

  it('export with the correct password returns the wallet secret', async () => {
    const a = await makeUser('a@e.com');
    const gen = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password });
    expect(res.status).toBe(200);
    expect(parseSecretKey(res.body.secretKey).publicKey.toBase58()).toBe(gen.body.publicKey);
  });

  it('export with a wrong password is rejected with 400', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: 'wrong' });
    expect(res.status).toBe(400);
  });

  it('withdraw with the correct password transfers and returns a txId', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password, destination: DEST, amountSol: 0.5 });
    expect(res.status).toBe(200);
    expect(res.body.txId).toBe('SIG_OK');
  });

  it('withdraw with a wrong password is rejected with 400', async () => {
    const a = await makeUser('a@e.com');
    await request(app).post('/api/wallet/generate').set('Authorization', `Bearer ${a.token}`);
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: 'wrong', destination: DEST, amountSol: 0.5 });
    expect(res.status).toBe(400);
  });

  it('export is scoped per user — A gets A\'s secret, never B\'s (IDOR)', async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');
    const genA = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${a.token}`);
    const genB = await request(app)
      .post('/api/wallet/generate')
      .set('Authorization', `Bearer ${b.token}`);
    expect(genA.body.publicKey).not.toBe(genB.body.publicKey);

    const exportA = await request(app)
      .post('/api/wallet/export')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ password: a.password });
    const pk = parseSecretKey(exportA.body.secretKey).publicKey.toBase58();
    expect(pk).toBe(genA.body.publicKey);
    expect(pk).not.toBe(genB.body.publicKey);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/controllers/__tests__/wallet.integration.test.ts`
Expected: PASS (8 tests). They should pass immediately since Tasks 1–5 already implemented the behavior — this task is the verification layer.

- [ ] **Step 3: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS — previous 72 + 3 (Task 1) + 3 (Task 3) + 5 (Task 4) + 8 (Task 6) = 91 tests.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/controllers/__tests__/wallet.integration.test.ts
git commit -m "test(wallet): HTTP integration + IDOR for the 4 wallet endpoints"
```

---

## Task 7: Frontend wallet-api clients

**Files:**
- Modify: `frontend/src/api/wallet-api.ts`

- [ ] **Step 1: Add the four API clients**

In `frontend/src/api/wallet-api.ts`, add after the existing `stopBot` export (before the `PositionView` interface is fine):

```ts
export const generateWallet = async (): Promise<{ publicKey: string }> => {
  const res = await api.post<{ publicKey: string }>('/wallet/generate');
  return res.data;
};

export const getBalance = async (): Promise<{ lamports: number; sol: number }> => {
  const res = await api.get<{ lamports: number; sol: number }>('/wallet/balance');
  return res.data;
};

export const withdrawSol = async (
  password: string,
  destination: string,
  amountSol: number | null,
  max: boolean
): Promise<{ txId: string }> => {
  const res = await api.post<{ txId: string }>('/wallet/withdraw', {
    password,
    destination,
    amountSol: amountSol ?? undefined,
    max,
  });
  return res.data;
};

export const exportSecret = async (password: string): Promise<{ secretKey: string }> => {
  const res = await api.post<{ secretKey: string }>('/wallet/export', { password });
  return res.data;
};
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/api/wallet-api.ts
git commit -m "feat(wallet): frontend API clients for generate/balance/withdraw/export"
```

---

## Task 8: `WalletPanel` component

**Files:**
- Create: `frontend/src/components/WalletPanel.tsx`

Replaces `CreateNewWalletBtn` (deleted in Task 11). Shows the public key, the SOL balance (with a refresh button), a "generate new wallet" button, a private-key paste/import box, and a delete button. If the balance is known to be > 0, it confirms before any destructive action (generate / replace / delete). Reports the current public key up to the parent via `onWalletChange` so the page can show/hide the withdraw and export sections.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/WalletPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  saveWallet,
  getWallet,
  deleteWallet,
  generateWallet,
  getBalance,
} from '@/api/wallet-api';

interface Props {
  onWalletChange?: (publicKey: string | null) => void;
}

export default function WalletPanel({ onWalletChange }: Props) {
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const setWallet = (pk: string | null) => {
    setPublicKey(pk);
    onWalletChange?.(pk);
  };

  useEffect(() => {
    getWallet()
      .then((w) => setWallet(w?.publicKey ?? null))
      .catch(() => setWallet(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBalance = async () => {
    setMessage('');
    try {
      const b = await getBalance();
      setBalanceSol(b.sol);
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Не удалось получить баланс'}`);
    }
  };

  // Guard destructive actions if we know the wallet still holds SOL.
  const confirmIfFunded = (action: string) => {
    if (balanceSol && balanceSol > 0) {
      return window.confirm(
        `На кошельке ${balanceSol} SOL. ${action} приведёт к потере доступа к этим средствам. Продолжить?`
      );
    }
    return true;
  };

  const handleGenerate = async () => {
    if (publicKey && !confirmIfFunded('Создание нового кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await generateWallet();
      setWallet(res.publicKey);
      setBalanceSol(null);
      setMessage('✅ Новый кошелёк создан');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка создания кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (publicKey && !confirmIfFunded('Замена кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await saveWallet(secret.trim());
      setWallet(res.publicKey);
      setBalanceSol(null);
      setSecret(''); // never keep the secret in memory longer than needed
      setMessage('✅ Кошелёк сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения кошелька'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmIfFunded('Удаление кошелька')) return;
    setLoading(true);
    setMessage('');
    try {
      await deleteWallet();
      setWallet(null);
      setBalanceSol(null);
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
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">
              <b>Баланс:</b> {balanceSol === null ? '—' : `${balanceSol} SOL`}
            </span>
            <button
              onClick={refreshBalance}
              disabled={loading}
              className="px-2 py-1 text-sm bg-gray-200 rounded-lg"
            >
              Обновить
            </button>
          </div>
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

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
      >
        {publicKey ? 'Создать новый кошелёк' : 'Создать кошелёк'}
      </button>

      <label className="block text-sm font-medium mb-1">
        Или вставьте приватный ключ (массив байт через запятую или base58)
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

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/WalletPanel.tsx
git commit -m "feat(wallet): WalletPanel with generate/import/balance/delete"
```

---

## Task 9: `WithdrawForm` component

**Files:**
- Create: `frontend/src/components/WithdrawForm.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/WithdrawForm.tsx`:

```tsx
import { useState } from 'react';
import { withdrawSol } from '@/api/wallet-api';

export default function WithdrawForm() {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [max, setMax] = useState(false);
  const [password, setPassword] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    !loading &&
    password.length > 0 &&
    destination.trim().length > 0 &&
    (max || Number(amount) > 0);

  const handleWithdraw = async () => {
    setLoading(true);
    setMessage('');
    setTxId(null);
    try {
      const amountSol = max ? null : Number(amount);
      const res = await withdrawSol(password, destination.trim(), amountSol, max);
      setTxId(res.txId);
      setPassword(''); // re-auth secret: drop it immediately
      setMessage('✅ Вывод отправлен');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка вывода'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Вывод SOL</h2>

      <label className="block text-sm font-medium mb-1">Адрес получателя</label>
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
        placeholder="Solana-адрес"
      />

      <label className="block text-sm font-medium mb-1">Сумма (SOL)</label>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={max}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-100"
          placeholder="0.0"
        />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={max} onChange={(e) => setMax(e.target.checked)} />
          Max
        </label>
      </div>

      <label className="block text-sm font-medium mb-1">Пароль аккаунта</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
        placeholder="Подтвердите паролем"
      />

      <button
        onClick={handleWithdraw}
        disabled={!canSubmit}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Отправка...' : 'Вывести'}
      </button>

      {txId && (
        <p className="mt-3 text-sm break-all">
          Транзакция:{' '}
          <a
            href={`https://solscan.io/tx/${txId}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            {txId}
          </a>
        </p>
      )}
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/WithdrawForm.tsx
git commit -m "feat(wallet): WithdrawForm with destination/amount/Max + password re-auth"
```

---

## Task 10: `ExportKeyDialog` component

**Files:**
- Create: `frontend/src/components/ExportKeyDialog.tsx`

Reveals the secret key once on success; the key lives only in this component's local state (never redux/localStorage) and can be hidden again.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/ExportKeyDialog.tsx`:

```tsx
import { useState } from 'react';
import { exportSecret } from '@/api/wallet-api';

export default function ExportKeyDialog() {
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await exportSecret(password);
      setSecretKey(res.secretKey);
      setPassword(''); // re-auth secret: drop it immediately
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка экспорта'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (secretKey) {
      await navigator.clipboard.writeText(secretKey);
      setMessage('Скопировано');
    }
  };

  const hide = () => {
    setSecretKey(null);
    setMessage('');
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Экспорт приватного ключа</h2>

      {secretKey ? (
        <div>
          <p className="text-sm text-red-600 mb-2">
            ⚠️ Никому не показывайте этот ключ. Любой, кто его получит, контролирует кошелёк.
          </p>
          <p className="break-all border border-gray-300 rounded-xl px-3 py-2 bg-gray-50">
            {secretKey}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={handleCopy} className="px-3 py-1 bg-blue-600 text-white rounded-lg">
              Скопировать
            </button>
            <button onClick={hide} className="px-3 py-1 bg-gray-300 rounded-lg">
              Скрыть
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Пароль аккаунта</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-2"
            placeholder="Подтвердите паролем"
          />
          <button
            onClick={handleExport}
            disabled={loading || password.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Проверка...' : 'Показать ключ'}
          </button>
        </div>
      )}

      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/ExportKeyDialog.tsx
git commit -m "feat(wallet): ExportKeyDialog with password re-auth + one-time reveal"
```

---

## Task 11: Wire into AccountSettingsPage + delete old component

**Files:**
- Modify: `frontend/src/pages/AccountSettingsPage.tsx`
- Delete: `frontend/src/components/CreateNewWalletBtn.tsx`

- [ ] **Step 1: Replace the page wiring**

Replace the entire contents of `frontend/src/pages/AccountSettingsPage.tsx` with:

```tsx
import { useEffect, useState } from "react";
import WalletPanel from "@/components/WalletPanel";
import WithdrawForm from "@/components/WithdrawForm";
import ExportKeyDialog from "@/components/ExportKeyDialog";
import BotControl from "@/components/BotControl";
import FilterSettings from "@/components/FilterSettings";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { getFilter } from "@/api/filter-api";

const AccountSettingsPage = () => {
    // Single source of truth for "is a filter configured?", shared by
    // FilterSettings (writes it on save) and BotControl (gates Start on it).
    const [hasFilter, setHasFilter] = useState(false);
    // Withdraw/export only make sense when a wallet exists; WalletPanel reports it up.
    const [walletPubKey, setWalletPubKey] = useState<string | null>(null);

    useEffect(() => {
        getFilter()
            .then((f) => setHasFilter(f !== null))
            .catch(() => setHasFilter(false));
    }, []);

    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletPanel onWalletChange={setWalletPubKey} />
                {walletPubKey && (
                    <>
                        <WithdrawForm />
                        <ExportKeyDialog />
                    </>
                )}
                <FilterSettings onSaved={() => setHasFilter(true)} />
                <BotControl hasFilter={hasFilter} />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
```

- [ ] **Step 2: Delete the obsolete component**

```bash
cd frontend && git rm src/components/CreateNewWalletBtn.tsx
```

- [ ] **Step 3: Verify nothing else imports the old component**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (If tsc reports a missing import for `CreateNewWalletBtn`/`WalletGenerator` anywhere else, update that import too — but `AccountSettingsPage` is the only known importer.)

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/pages/AccountSettingsPage.tsx
git commit -m "feat(wallet): render WalletPanel/WithdrawForm/ExportKeyDialog; drop CreateNewWalletBtn"
```

---

## Final verification

- [ ] **Backend tests:** `cd backend && npx vitest run` → all pass (~91 tests).
- [ ] **Backend typecheck:** `cd backend && npx tsc --noEmit` → clean.
- [ ] **Frontend typecheck:** `cd frontend && npx tsc --noEmit` → clean.
- [ ] **Working-tree check:** `git status` shows only the intentional unstaged `backend/src/services/user-service.ts` dev bypass and the untracked `frontend/src/assets/image.png` — nothing else stray, and the dev bypass was NOT committed.
- [ ] Manual e2e (optional, needs funded wallet + real `.env`): generate a wallet, refresh balance, export with password, attempt a small withdraw.

Frontend has no unit-test harness in this project, so frontend verification = tsc + manual check, per the spec.
