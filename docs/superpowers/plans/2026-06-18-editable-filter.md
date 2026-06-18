# Editable Per-User Candidate Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the trading bot's candidate filter from global constants to editable per-user settings stored in MongoDB, configurable from a form on the account settings page.

**Architecture:** New `FilterConfig` Mongoose collection (one doc per user) holds four editable thresholds. A `filter-config-service` validates and persists them. `passesFilter` takes the filter as a parameter; the worker loads each user's filter per buy-pass. `GET/PUT /filter` endpoints expose it; `POST /bot/start` is gated on a filter existing. The frontend gets a `FilterSettings` form with an "applied filter" panel.

**Tech Stack:** Express 5 + TypeScript, Mongoose, vitest + mongodb-memory-server (unit/integration), supertest (HTTP integration), React + Vite + Tailwind.

---

## Spec

`docs/superpowers/specs/2026-06-18-editable-filter-design.md`

## Editable fields (the four thresholds)

| Field | Type | Validation |
|-------|------|------------|
| `minLiquidityUSD` | number | `>= 0` |
| `maxMarketCapUSD` | number | `> 0` |
| `maxAgeMinutes` | number | integer `> 0` |
| `minBoosts` | number | integer `>= 0` |

`chainId` (`solana`) and `ALLOWED_DEXES` (`raydium`, `pumpswap`) stay as constants in `trading-config.ts` — not editable in this phase.

## File Structure

**Backend — create:**
- `backend/src/models/filter-config-model.ts` — `FilterValues` interface + `FilterConfig` schema/model.
- `backend/src/services/filter-config-service.ts` — `validateFilterValues` (pure) + CRUD service.
- `backend/src/controllers/filter-controller.ts` — `GET`/`PUT /filter` handlers.
- `backend/src/app.ts` — exports the configured Express app (extracted from `index.ts`) so tests can mount it.
- `backend/vitest.setup.ts` — sets JWT/wallet env defaults so the full app graph loads under test.
- `backend/src/services/__tests__/filter-config-service.test.ts`
- `backend/src/controllers/__tests__/filter.integration.test.ts`
- `backend/src/controllers/__tests__/bot-start.integration.test.ts`

**Backend — modify:**
- `backend/src/services/filter.ts` — `passesFilter(c, nowMs, filter)`.
- `backend/src/services/__tests__/filter.test.ts` — thread a filter object through.
- `backend/src/worker/engine.ts` — load per-user filter in `runBuyPass`.
- `backend/src/routes/index.ts` — add filter routes.
- `backend/src/controllers/wallet-controller.ts` — gate `startBot` on a filter existing.
- `backend/src/index.ts` — import the app from `app.ts`.
- `backend/vitest.config.ts` — register `setupFiles`.
- `backend/package.json` — add `supertest` + `@types/supertest` (dev).

**Frontend — create:**
- `frontend/src/utils/format-number.ts` — thousands format/parse helpers.
- `frontend/src/api/filter-api.ts` — `getFilter` / `saveFilter`.
- `frontend/src/components/FilterSettings.tsx` — form + applied-filter panel.

**Frontend — modify:**
- `frontend/src/pages/AccountSettingsPage.tsx` — render `<FilterSettings/>`.
- `frontend/src/components/BotControl.tsx` — disable Start until a filter is saved.

## Testing note (frontend)

The frontend has **no test runner** (scripts are only `dev`/`build`/`lint`/`preview`). Standing up vitest there is out of scope for this feature, so `format-number.ts` is kept as a pure, side-effect-free module verified by `tsc -b` and manual UI testing rather than an automated unit test. All automated tests in this plan are backend (vitest).

## Commands reference

- Backend single test file: from `backend/` run `npx vitest run <path>`
- Backend all tests: from `backend/` run `npm test`
- Backend typecheck: from `backend/` run `npx tsc --noEmit`
- Frontend typecheck/build: from `frontend/` run `npx tsc -b`

---

### Task 1: `FilterConfig` model + `validateFilterValues`

**Files:**
- Create: `backend/src/models/filter-config-model.ts`
- Create: `backend/src/services/filter-config-service.ts` (validation only in this task)
- Test: `backend/src/services/__tests__/filter-config-service.test.ts`

- [ ] **Step 1: Create the model**

`backend/src/models/filter-config-model.ts`:

```ts
import { Schema, model, Types } from 'mongoose';

export interface FilterValues {
  minLiquidityUSD: number;
  maxMarketCapUSD: number;
  maxAgeMinutes: number;
  minBoosts: number;
}

export interface FilterConfig extends FilterValues {
  user: Types.ObjectId;
  updatedAt: Date;
}

const FilterConfigSchema = new Schema<FilterConfig>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  minLiquidityUSD: { type: Number, required: true },
  maxMarketCapUSD: { type: Number, required: true },
  maxAgeMinutes: { type: Number, required: true },
  minBoosts: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const FilterConfigModel = model<FilterConfig>('FilterConfig', FilterConfigSchema);
```

- [ ] **Step 2: Create the service file with `validateFilterValues` only**

`backend/src/services/filter-config-service.ts`:

```ts
import { FilterConfigModel, FilterValues } from '../models/filter-config-model';
import ApiError from '../exceptions/api-errors';

const FIELDS = ['minLiquidityUSD', 'maxMarketCapUSD', 'maxAgeMinutes', 'minBoosts'] as const;

/** Validate raw input into a clean FilterValues, throwing ApiError.BadRequest on any violation. */
export function validateFilterValues(raw: any): FilterValues {
  const out = {} as FilterValues;
  for (const f of FIELDS) {
    const v = raw?.[f];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw ApiError.BadRequest(`${f} must be a finite number`);
    }
    out[f] = v;
  }
  if (out.minLiquidityUSD < 0) throw ApiError.BadRequest('minLiquidityUSD must be >= 0');
  if (out.maxMarketCapUSD <= 0) throw ApiError.BadRequest('maxMarketCapUSD must be > 0');
  if (!Number.isInteger(out.maxAgeMinutes) || out.maxAgeMinutes <= 0) {
    throw ApiError.BadRequest('maxAgeMinutes must be a positive integer');
  }
  if (!Number.isInteger(out.minBoosts) || out.minBoosts < 0) {
    throw ApiError.BadRequest('minBoosts must be a non-negative integer');
  }
  return out;
}

class FilterConfigService {
  // CRUD methods added in Task 2
}

export default new FilterConfigService();
```

- [ ] **Step 3: Write the failing validation test**

`backend/src/services/__tests__/filter-config-service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateFilterValues } from '../filter-config-service';
import ApiError from '../../exceptions/api-errors';

const valid = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

describe('validateFilterValues', () => {
  it('accepts a valid filter', () => {
    expect(validateFilterValues(valid)).toEqual(valid);
  });
  it('accepts minLiquidityUSD = 0 and minBoosts = 0', () => {
    const v = { ...valid, minLiquidityUSD: 0, minBoosts: 0 };
    expect(validateFilterValues(v)).toEqual(v);
  });
  it('rejects a missing field', () => {
    expect(() => validateFilterValues({ ...valid, minBoosts: undefined })).toThrow(ApiError);
  });
  it('rejects a non-numeric field', () => {
    expect(() => validateFilterValues({ ...valid, maxMarketCapUSD: '5' })).toThrow(ApiError);
  });
  it('rejects maxMarketCapUSD = 0', () => {
    expect(() => validateFilterValues({ ...valid, maxMarketCapUSD: 0 })).toThrow(ApiError);
  });
  it('rejects maxAgeMinutes = 0', () => {
    expect(() => validateFilterValues({ ...valid, maxAgeMinutes: 0 })).toThrow(ApiError);
  });
  it('rejects non-integer maxAgeMinutes', () => {
    expect(() => validateFilterValues({ ...valid, maxAgeMinutes: 1.5 })).toThrow(ApiError);
  });
  it('rejects negative minLiquidityUSD', () => {
    expect(() => validateFilterValues({ ...valid, minLiquidityUSD: -1 })).toThrow(ApiError);
  });
  it('rejects non-integer minBoosts', () => {
    expect(() => validateFilterValues({ ...valid, minBoosts: 1.5 })).toThrow(ApiError);
  });
});
```

- [ ] **Step 4: Run the test**

From `backend/`: `npx vitest run src/services/__tests__/filter-config-service.test.ts`
Expected: PASS (8 tests). If it fails, fix `validateFilterValues` to match.

- [ ] **Step 5: Typecheck + commit**

From `backend/`: `npx tsc --noEmit` → expected: no errors.

```bash
git add backend/src/models/filter-config-model.ts backend/src/services/filter-config-service.ts backend/src/services/__tests__/filter-config-service.test.ts
git commit -m "feat(filter): FilterConfig model + filter-value validation"
```

---

### Task 2: `filter-config-service` CRUD

**Files:**
- Modify: `backend/src/services/filter-config-service.ts`
- Test: `backend/src/services/__tests__/filter-config-service.test.ts`

- [ ] **Step 1: Add the failing CRUD test**

Append to `backend/src/services/__tests__/filter-config-service.test.ts` (add the new imports at the top of the file alongside the existing ones):

```ts
import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import filterConfigService from '../filter-config-service';
import { FilterConfigModel } from '../../models/filter-config-model';

let mongod: MongoMemoryServer;
const userId = new mongoose.Types.ObjectId().toString();

describe('filter-config-service CRUD', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await FilterConfigModel.deleteMany({});
  });

  it('getForUser returns null when nothing saved', async () => {
    expect(await filterConfigService.getForUser(userId)).toBeNull();
    expect(await filterConfigService.hasForUser(userId)).toBe(false);
  });

  it('saveForUser persists and getForUser reads back', async () => {
    const saved = await filterConfigService.saveForUser(userId, valid);
    expect(saved).toEqual(valid);
    expect(await filterConfigService.getForUser(userId)).toEqual(valid);
    expect(await filterConfigService.hasForUser(userId)).toBe(true);
  });

  it('saveForUser upserts (one doc per user)', async () => {
    await filterConfigService.saveForUser(userId, valid);
    await filterConfigService.saveForUser(userId, { ...valid, minBoosts: 99 });
    expect(await FilterConfigModel.countDocuments({ user: userId })).toBe(1);
    expect((await filterConfigService.getForUser(userId))!.minBoosts).toBe(99);
  });

  it('saveForUser rejects invalid input', async () => {
    await expect(filterConfigService.saveForUser(userId, { ...valid, maxMarketCapUSD: 0 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

From `backend/`: `npx vitest run src/services/__tests__/filter-config-service.test.ts`
Expected: FAIL — `filterConfigService.getForUser is not a function`.

- [ ] **Step 3: Implement the CRUD methods**

Replace the empty `class FilterConfigService {}` body in `backend/src/services/filter-config-service.ts`:

```ts
class FilterConfigService {
  async getForUser(userId: string): Promise<FilterValues | null> {
    const doc = await FilterConfigModel.findOne({ user: userId });
    if (!doc) return null;
    return {
      minLiquidityUSD: doc.minLiquidityUSD,
      maxMarketCapUSD: doc.maxMarketCapUSD,
      maxAgeMinutes: doc.maxAgeMinutes,
      minBoosts: doc.minBoosts,
    };
  }

  async saveForUser(userId: string, raw: any): Promise<FilterValues> {
    const values = validateFilterValues(raw);
    await FilterConfigModel.findOneAndUpdate(
      { user: userId },
      { user: userId, ...values, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return values;
  }

  async hasForUser(userId: string): Promise<boolean> {
    return (await FilterConfigModel.exists({ user: userId })) !== null;
  }
}
```

- [ ] **Step 4: Run the test**

From `backend/`: `npx vitest run src/services/__tests__/filter-config-service.test.ts`
Expected: PASS (all validation + CRUD tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/filter-config-service.ts backend/src/services/__tests__/filter-config-service.test.ts
git commit -m "feat(filter): filter-config-service CRUD (get/save/has per user)"
```

---

### Task 3: `passesFilter` takes a filter param + engine loads it per user

**Files:**
- Modify: `backend/src/services/filter.ts`
- Modify: `backend/src/services/__tests__/filter.test.ts`
- Modify: `backend/src/worker/engine.ts:31-39`

- [ ] **Step 1: Update the failing filter test first**

Replace `backend/src/services/__tests__/filter.test.ts` entirely:

```ts
import { describe, it, expect } from 'vitest';
import { passesFilter, dedupeByBaseToken, Candidate } from '../filter';
import { FilterValues } from '../../models/filter-config-model';

const now = Date.now();
const filter: FilterValues = {
  minLiquidityUSD: 25000,
  maxMarketCapUSD: 1300000,
  maxAgeMinutes: 25,
  minBoosts: 50,
};

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
    expect(passesFilter(make({}), now, filter)).toBe(true);
  });
  it('rejects wrong chain', () => {
    expect(passesFilter(make({ chainId: 'ethereum' }), now, filter)).toBe(false);
  });
  it('rejects disallowed dex', () => {
    expect(passesFilter(make({ dexId: 'orca' as any }), now, filter)).toBe(false);
  });
  it('rejects liquidity below the filter', () => {
    expect(passesFilter(make({ liquidity: { usd: 24999 } }), now, filter)).toBe(false);
  });
  it('accepts liquidity exactly at the filter', () => {
    expect(passesFilter(make({ liquidity: { usd: 25000 } }), now, filter)).toBe(true);
  });
  it('rejects market cap above the filter', () => {
    expect(passesFilter(make({ marketCap: 1300001 }), now, filter)).toBe(false);
  });
  it('rejects boosts below the filter', () => {
    expect(passesFilter(make({ boosts: { active: 49 } }), now, filter)).toBe(false);
  });
  it('rejects a token older than maxAgeMinutes', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 26 * 60 * 1000 }), now, filter)).toBe(false);
  });
  it('accepts a token within maxAgeMinutes', () => {
    expect(passesFilter(make({ pairCreatedAt: now - 24 * 60 * 1000 }), now, filter)).toBe(true);
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

- [ ] **Step 2: Run it to confirm it fails**

From `backend/`: `npx vitest run src/services/__tests__/filter.test.ts`
Expected: FAIL — `passesFilter` expects 2 args / type error at runtime (filter ignored).

- [ ] **Step 3: Update `passesFilter`**

In `backend/src/services/filter.ts`, add the import and replace the function:

```ts
import { FILTER } from '../config/trading-config';
import { DexId } from '../models/position-model';
import { FilterValues } from '../models/filter-config-model';
```

```ts
export function passesFilter(c: Candidate, nowMs: number, filter: FilterValues): boolean {
  const nowSec = Math.floor(nowMs / 1000);
  const minCreatedSec = nowSec - filter.maxAgeMinutes * 60;
  const liquidityUsd = c.liquidity?.usd ?? 0;
  return (
    c.chainId === FILTER.CHAIN_ID &&
    (FILTER.ALLOWED_DEXES as readonly string[]).includes(c.dexId) &&
    liquidityUsd >= filter.minLiquidityUSD &&
    c.marketCap <= filter.maxMarketCapUSD &&
    c.boosts.active >= filter.minBoosts &&
    Math.floor(c.pairCreatedAt / 1000) >= minCreatedSec
  );
}
```

(Leave `FILTER.MIN_LIQUIDITY_USD`, `MAX_MARKET_CAP_USD`, `MIN_BOOSTS` and `TRADING.MAX_TOKEN_AGE_SEC` in `trading-config.ts` untouched — they are now superseded for the engine but other tests reference the config object. Do not delete them in this task.)

- [ ] **Step 4: Update the engine call site**

In `backend/src/worker/engine.ts`, add the import:

```ts
import filterConfigService from '../services/filter-config-service';
```

Replace the top of `runBuyPass` (currently lines ~31-39) so it loads the user's filter and passes it in:

```ts
export async function runBuyPass(userId: string, owner: Keypair, lastBuyAt: { value: number }) {
  if ((await positionService.countOpen(userId)) >= TRADING.MAX_OPEN_POSITIONS) return;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - lastBuyAt.value < TRADING.BUY_COOLDOWN_SEC) return;

  const filter = await filterConfigService.getForUser(userId);
  if (!filter) return; // bot must not trade without a configured filter

  const candidates = dedupeByBaseToken(await fetchCandidates()).filter((c) =>
    passesFilter(c, Date.now(), filter)
  );
  // ... rest of runBuyPass unchanged
```

- [ ] **Step 5: Run filter tests + typecheck**

From `backend/`:
- `npx vitest run src/services/__tests__/filter.test.ts` → expected: PASS
- `npx tsc --noEmit` → expected: no errors (engine now compiles against the new signature)

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/filter.ts backend/src/services/__tests__/filter.test.ts backend/src/worker/engine.ts
git commit -m "feat(filter): passesFilter takes per-user filter; engine loads it each buy pass"
```

---

### Task 4: Extract `app.ts` + test env setup

**Files:**
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Create: `backend/vitest.setup.ts`
- Modify: `backend/vitest.config.ts`

- [ ] **Step 1: Create `app.ts`**

`backend/src/app.ts`:

```ts
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import router from './routes/index';
import errorMiddleware from './middleware/error-middleware';

const CLIENT_URL = 'http://localhost:5173';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', router);
  app.use(errorMiddleware);
  return app;
}

export default createApp();
```

- [ ] **Step 2: Slim down `index.ts` to use it**

Replace `backend/src/index.ts` entirely:

```ts
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  throw new Error('DB_URL is not defined in .env');
}

const start = async () => {
  try {
    await mongoose.connect(dbUrl);
    app.listen(PORT, () => console.log(`Server startd on PORT =  ${PORT}`));
  } catch (e) {
    console.log(e);
  }
};

start();
```

- [ ] **Step 3: Create the vitest setup file**

`backend/vitest.setup.ts` — sets env defaults so importing the full app graph (which pulls in `token-service`, reading JWT secrets at module load) never throws under test, even with no `.env`:

```ts
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
process.env.WALLET_ENCRYPTION_KEY ||= '0'.repeat(64);
```

- [ ] **Step 4: Register the setup file**

Replace `backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 5: Run the full suite + typecheck (nothing should regress)**

From `backend/`:
- `npm test` → expected: all existing tests still PASS.
- `npx tsc --noEmit` → expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/src/index.ts backend/vitest.setup.ts backend/vitest.config.ts
git commit -m "refactor(server): export app from app.ts; add vitest env setup for integration tests"
```

---

### Task 5: Filter routes + controller + HTTP integration/IDOR tests

**Files:**
- Create: `backend/src/controllers/filter-controller.ts`
- Modify: `backend/src/routes/index.ts:7,53` (add import + routes)
- Modify: `backend/package.json` (add supertest dev deps)
- Test: `backend/src/controllers/__tests__/filter.integration.test.ts`

- [ ] **Step 1: Install supertest**

From `backend/`: `npm install -D supertest @types/supertest`

- [ ] **Step 2: Create the controller**

`backend/src/controllers/filter-controller.ts`:

```ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import filterConfigService from '../services/filter-config-service';

class FilterController {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await filterConfigService.getForUser(userId));
    } catch (e) {
      next(e);
    }
  }

  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const saved = await filterConfigService.saveForUser(userId, req.body);
      return res.json(saved);
    } catch (e) {
      next(e); // ApiError.BadRequest from validation -> 400 via errorMiddleware
    }
  }
}

export default new FilterController();
```

- [ ] **Step 3: Wire the routes**

In `backend/src/routes/index.ts`, add the import near the other controller imports:

```ts
import FilterController from '../controllers/filter-controller';
```

And add the routes next to the wallet routes (after the `/bot/stop` line):

```ts
router.get('/filter', authMiddleware, FilterController.get);
router.put('/filter', authMiddleware, FilterController.save);
```

- [ ] **Step 4: Write the failing integration test**

`backend/src/controllers/__tests__/filter.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { FilterConfigModel } from '../../models/filter-config-model';

let mongod: MongoMemoryServer;

const validFilter = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken };
}

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
  await FilterConfigModel.deleteMany({});
});

describe('filter endpoints', () => {
  it('rejects unauthenticated PUT /filter', async () => {
    const res = await request(app).put('/api/filter').send(validFilter);
    expect(res.status).toBe(401);
  });

  it('saves and reads back a filter', async () => {
    const a = await makeUser('a@e.com');
    const put = await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send(validFilter);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject(validFilter);

    const get = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject(validFilter);
  });

  it('returns null when no filter configured', async () => {
    const a = await makeUser('a@e.com');
    const get = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(get.status).toBe(200);
    expect(get.body).toBeNull();
  });

  it('rejects an invalid filter (maxMarketCapUSD = 0) with 400', async () => {
    const a = await makeUser('a@e.com');
    const res = await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ ...validFilter, maxMarketCapUSD: 0 });
    expect(res.status).toBe(400);
  });

  it('does not leak or overwrite another user filter (IDOR)', async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');

    // B saves a filter
    await request(app).put('/api/filter').set('Authorization', `Bearer ${b.token}`).send(validFilter);

    // A has no filter of its own
    const aGet = await request(app).get('/api/filter').set('Authorization', `Bearer ${a.token}`);
    expect(aGet.body).toBeNull();

    // A saving its own does not touch B's
    await request(app)
      .put('/api/filter')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ ...validFilter, minBoosts: 1 });
    const bGet = await request(app).get('/api/filter').set('Authorization', `Bearer ${b.token}`);
    expect(bGet.body).toMatchObject({ minBoosts: 50 });
  });
});
```

- [ ] **Step 5: Run it**

From `backend/`: `npx vitest run src/controllers/__tests__/filter.integration.test.ts`
Expected: PASS (5 tests). If 401 cases fail, confirm `authMiddleware` is on both routes; if the app import throws, confirm `vitest.setup.ts` is registered (Task 4).

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/filter-controller.ts backend/src/routes/index.ts backend/src/controllers/__tests__/filter.integration.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(filter): GET/PUT /filter endpoints with auth + IDOR integration tests"
```

---

### Task 6: Gate `POST /bot/start` on a configured filter

**Files:**
- Modify: `backend/src/controllers/wallet-controller.ts:48-59`
- Test: `backend/src/controllers/__tests__/bot-start.integration.test.ts`

- [ ] **Step 1: Write the failing gate test**

`backend/src/controllers/__tests__/bot-start.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { WalletModel } from '../../models/wallet-model';
import { FilterConfigModel } from '../../models/filter-config-model';

let mongod: MongoMemoryServer;

const validFilter = { minLiquidityUSD: 25000, maxMarketCapUSD: 1300000, maxAgeMinutes: 25, minBoosts: 50 };

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({ id: user._id.toString(), email, isActivated: true });
  return { id: user._id.toString(), token: accessToken };
}

async function giveWallet(userId: string) {
  await WalletModel.create({
    user: userId,
    publicKey: 'pk',
    encryptedSecret: 'e',
    iv: 'i',
    authTag: 't',
  });
}

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
  await WalletModel.deleteMany({});
  await FilterConfigModel.deleteMany({});
});

describe('POST /bot/start filter gate', () => {
  it('blocks bot start when no filter is configured', async () => {
    const a = await makeUser('a@e.com');
    await giveWallet(a.id);
    const res = await request(app).post('/api/bot/start').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(400);
  });

  it('allows bot start once a filter exists', async () => {
    const a = await makeUser('a@e.com');
    await giveWallet(a.id);
    await request(app).put('/api/filter').set('Authorization', `Bearer ${a.token}`).send(validFilter);
    const res = await request(app).post('/api/bot/start').set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ botEnabled: true });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

From `backend/`: `npx vitest run src/controllers/__tests__/bot-start.integration.test.ts`
Expected: FAIL — the "blocks" test gets 200 instead of 400 (no gate yet).

- [ ] **Step 3: Add the gate**

In `backend/src/controllers/wallet-controller.ts`, add the import:

```ts
import filterConfigService from '../services/filter-config-service';
```

Update `startBot` so it checks the filter after the wallet check:

```ts
  async startBot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('Add a wallet before starting the bot'));
      if (!(await filterConfigService.hasForUser(userId))) {
        return next(ApiError.BadRequest('Configure a filter before starting the bot'));
      }
      await walletService.setBotEnabled(userId, true);
      return res.json({ botEnabled: true });
    } catch (e) {
      next(e);
    }
  }
```

- [ ] **Step 4: Run the test + typecheck**

From `backend/`:
- `npx vitest run src/controllers/__tests__/bot-start.integration.test.ts` → expected: PASS
- `npx tsc --noEmit` → expected: no errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/wallet-controller.ts backend/src/controllers/__tests__/bot-start.integration.test.ts
git commit -m "feat(filter): block POST /bot/start until a filter is configured"
```

---

### Task 7: Frontend — number-format helper + filter API client

**Files:**
- Create: `frontend/src/utils/format-number.ts`
- Create: `frontend/src/api/filter-api.ts`

- [ ] **Step 1: Create the format helper**

`frontend/src/utils/format-number.ts`:

```ts
/** "1300000" or 1300000 -> "1,300,000"; empty/invalid -> "". Digits only. */
export function formatThousands(value: number | string): string {
  const digits = String(value).replace(/\D/g, '');
  if (digits === '') return '';
  return Number(digits).toLocaleString('en-US');
}

/** "1,300,000" -> 1300000; empty -> 0. Digits only. */
export function parseThousands(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? 0 : Number(digits);
}
```

- [ ] **Step 2: Create the API client**

`frontend/src/api/filter-api.ts`:

```ts
import api from './axiosInstance';

export interface FilterValues {
  minLiquidityUSD: number;
  maxMarketCapUSD: number;
  maxAgeMinutes: number;
  minBoosts: number;
}

export const getFilter = async (): Promise<FilterValues | null> => {
  const res = await api.get<FilterValues | null>('/filter');
  return res.data;
};

export const saveFilter = async (values: FilterValues): Promise<FilterValues> => {
  const res = await api.put<FilterValues>('/filter', values);
  return res.data;
};
```

- [ ] **Step 3: Typecheck**

From `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/format-number.ts frontend/src/api/filter-api.ts
git commit -m "feat(filter): frontend number-format helper + filter API client"
```

---

### Task 8: Frontend — `FilterSettings` component + settings page

**Files:**
- Create: `frontend/src/components/FilterSettings.tsx`
- Modify: `frontend/src/pages/AccountSettingsPage.tsx`

- [ ] **Step 1: Create the component**

`frontend/src/components/FilterSettings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getFilter, saveFilter, FilterValues } from '@/api/filter-api';
import { formatThousands, parseThousands } from '@/utils/format-number';

type FormState = {
  minLiquidityUSD: string; // formatted with thousands separators
  maxMarketCapUSD: string; // formatted with thousands separators
  maxAgeMinutes: string;
  minBoosts: string;
};

const EMPTY: FormState = { minLiquidityUSD: '', maxMarketCapUSD: '', maxAgeMinutes: '', minBoosts: '' };

export default function FilterSettings() {
  const [applied, setApplied] = useState<FilterValues | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFilter()
      .then((f) => {
        setApplied(f);
        if (f) {
          setForm({
            minLiquidityUSD: formatThousands(f.minLiquidityUSD),
            maxMarketCapUSD: formatThousands(f.maxMarketCapUSD),
            maxAgeMinutes: String(f.maxAgeMinutes),
            minBoosts: String(f.minBoosts),
          });
        }
      })
      .catch(() => setApplied(null));
  }, []);

  const setMoney = (key: 'minLiquidityUSD' | 'maxMarketCapUSD') => (raw: string) =>
    setForm((s) => ({ ...s, [key]: formatThousands(raw) }));

  const setInt = (key: 'maxAgeMinutes' | 'minBoosts') => (raw: string) =>
    setForm((s) => ({ ...s, [key]: raw.replace(/\D/g, '') }));

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      const values: FilterValues = {
        minLiquidityUSD: parseThousands(form.minLiquidityUSD),
        maxMarketCapUSD: parseThousands(form.maxMarketCapUSD),
        maxAgeMinutes: parseThousands(form.maxAgeMinutes),
        minBoosts: parseThousands(form.minBoosts),
      };
      const saved = await saveFilter(values);
      setApplied(saved);
      setMessage('✅ Фильтр сохранён');
    } catch (e: any) {
      setMessage(`❌ ${e?.response?.data?.message || 'Ошибка сохранения фильтра'}`);
    } finally {
      setLoading(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) => (
    <label className="block mb-3">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl px-3 py-2"
      />
    </label>
  );

  return (
    <div className="p-4 max-w-md">
      <h2 className="text-lg font-bold mb-2">Фильтр кандидатов</h2>

      <div className="mb-4 p-3 rounded-xl bg-gray-100 text-sm">
        <p className="font-semibold mb-1">Применённый фильтр</p>
        {applied ? (
          <ul className="space-y-0.5">
            <li>Мин. ликвидность: ${formatThousands(applied.minLiquidityUSD)}</li>
            <li>Макс. капитализация: ${formatThousands(applied.maxMarketCapUSD)}</li>
            <li>Макс. возраст: {applied.maxAgeMinutes} мин</li>
            <li>Мин. бусты: {applied.minBoosts}</li>
          </ul>
        ) : (
          <p className="text-gray-600">Фильтр не настроен.</p>
        )}
      </div>

      {field('Мин. ликвидность ($)', form.minLiquidityUSD, setMoney('minLiquidityUSD'), 'напр. 25,000')}
      {field('Макс. капитализация ($)', form.maxMarketCapUSD, setMoney('maxMarketCapUSD'), 'напр. 1,300,000')}
      {field('Макс. возраст (минуты)', form.maxAgeMinutes, setInt('maxAgeMinutes'), 'напр. 25')}
      {field('Мин. бусты', form.minBoosts, setInt('minBoosts'), 'напр. 50')}

      <button
        onClick={handleSave}
        disabled={loading}
        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {loading ? 'Сохранение...' : 'Сохранить фильтр'}
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the settings page**

Replace `frontend/src/pages/AccountSettingsPage.tsx`:

```tsx
import WalletGenerator from "@/components/CreateNewWalletBtn";
import BotControl from "@/components/BotControl";
import FilterSettings from "@/components/FilterSettings";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

const AccountSettingsPage = () => {
    return (
        <MaxWidthWrapper>
            <div>
                <h1 className="text-xl font-bold">Настройки аккаунта</h1>
                <WalletGenerator />
                <FilterSettings />
                <BotControl />
            </div>
        </MaxWidthWrapper>
    );
};

export default AccountSettingsPage;
```

- [ ] **Step 3: Typecheck**

From `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Manual check**

Start backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`). On the settings page: enter `25000` in liquidity → shows `25,000`; save → "Применённый фильтр" panel updates; reload → values persist; saving with an empty field → server 400 surfaces as a red error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterSettings.tsx frontend/src/pages/AccountSettingsPage.tsx
git commit -m "feat(filter): FilterSettings form with applied-filter panel on settings page"
```

---

### Task 9: Frontend — disable bot Start until a filter is saved

**Files:**
- Modify: `frontend/src/components/BotControl.tsx`

- [ ] **Step 1: Update `BotControl` to require a filter**

Replace `frontend/src/components/BotControl.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getWallet, startBot, stopBot } from '@/api/wallet-api';
import { getFilter } from '@/api/filter-api';

export default function BotControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [hasFilter, setHasFilter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallet()
      .then((w) => setEnabled(w?.botEnabled ?? false))
      .catch(() => setEnabled(false));
    getFilter()
      .then((f) => setHasFilter(f !== null))
      .catch(() => setHasFilter(false));
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

  const startDisabled = !enabled && !hasFilter;

  return (
    <div className="p-4">
      <p className="mb-2">Бот: <b>{enabled ? 'ВКЛ' : 'ВЫКЛ'}</b></p>
      <button
        onClick={toggle}
        disabled={loading || startDisabled}
        className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${enabled ? 'bg-red-600' : 'bg-green-600'}`}
      >
        {loading ? '...' : enabled ? 'Остановить бота' : 'Запустить бота'}
      </button>
      {startDisabled && (
        <p className="mt-2 text-sm text-gray-600">Настройте фильтр, чтобы запустить бота.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

From `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual check**

With no filter saved: Start button is disabled with the hint. After saving a filter (and reloading), Start becomes enabled.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BotControl.tsx
git commit -m "feat(filter): disable bot Start until a filter is configured"
```

---

### Task 10: Full verification

- [ ] **Step 1: Backend — full test suite**

From `backend/`: `npm test`
Expected: all suites PASS (existing + new `filter-config-service`, `filter`, `filter.integration`, `bot-start.integration`).

- [ ] **Step 2: Backend — typecheck**

From `backend/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Frontend — build/typecheck**

From `frontend/`: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: End-to-end manual smoke**

With backend + frontend running and a registered/activated account:
1. Settings page shows "Фильтр не настроен" and a disabled Start button.
2. Enter all four fields, save → applied panel updates, money fields show comma grouping.
3. Reload → values persist; Start button is now enabled.
4. Saving with a field left blank → red validation error from the server (400).

- [ ] **Step 5: Final commit (if any uncommitted touch-ups remain)**

```bash
git status
# commit only intended files if anything remains
```

---

## Self-Review (completed during planning)

- **Spec coverage:** model (Task 1), validation rules table (Task 1), `GET/PUT /filter` (Task 5), per-user engine read (Task 3), bot-start gate (Task 6), frontend form + applied panel + thousands formatting (Tasks 7–8), Start gating (Task 9), unit + integration/IDOR tests (Tasks 1–6). Frontend helper auto-test intentionally omitted (no frontend test runner) — documented in "Testing note".
- **Type consistency:** `FilterValues` is defined once in `filter-config-model.ts` and reused by `filter.ts`, the service, controller, and (mirrored) the frontend `filter-api.ts`. Service methods `getForUser` / `saveForUser` / `hasForUser` and the pure `validateFilterValues` are referenced consistently across Tasks 2, 3, 5, 6.
- **Placeholders:** none — every code step is complete.
- **Out of scope (unchanged):** `chainId` / `ALLOWED_DEXES`, trading params, and the two unrelated Sub-project 1 tails (wallet/positions/trades IDOR tests, DexScreener candidate-refresh throttling).
```
