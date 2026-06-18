# Аналитика / PnL — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать пользователю кривую накопленного реализованного PnL и сводные KPI на дашборде, считая всё из коллекции `Trade` (без чтений с блокчейна).

**Architecture:** Бэкенд получает чистую функцию `buildPnlAnalytics(trades)` → `{ series, kpis }`, отдаёт её через `GET /api/analytics/pnl` (authMiddleware, scoped по `req.user.id`). Фронт ставит `recharts`, добавляет API-клиент и две презентационные компоненты, рендерит их секцией сверху `DashboardPage`. Снапшот-воркер и изменения моделей не нужны.

**Tech Stack:** TypeScript, Express 5, Mongoose, Vitest + supertest + mongodb-memory-server (backend); React + Vite + Tailwind + recharts (frontend).

**Спек:** `docs/superpowers/specs/2026-06-18-analytics-pnl-design.md`

**Важные факты кодовой базы:**
- Роуты монтируются под `/api` (`backend/src/app.ts` → `app.use('/api', router)`); в тестах путь `/api/analytics/pnl`.
- Фронтовый `axiosInstance` уже имеет `baseURL=.../api`, поэтому клиент зовёт `/analytics/pnl`.
- Паттерн контроллера: `const userId = req.user?.id; if (!userId) return next(ApiError.UnauthorizedError());` затем `next(e)` в catch.
- `positionService.getTrades(userId)` уже возвращает `TradeModel.find({ user }).sort({ closedAt: -1 })`.
- Фронт-алиас путей: `@/...`.
- НЕ переиспользовать `formatThousands` для USD — он digits-only (без минусов/дробей). Заводим локальный `formatUsd`.

**Замечание по коммитам:** в рабочем дереве лежит намеренный локальный dev-байпас `backend/src/services/user-service.ts` (НЕ коммитить) и нетреканный `frontend/src/assets/image.png`. Всегда `git add` только явными путями — никогда `-A`/`.`.

---

### Task 1: Чистая функция аналитики PnL (backend, TDD)

**Files:**
- Create: `backend/src/services/analytics-service.ts`
- Test: `backend/src/services/__tests__/analytics-service.test.ts`

- [ ] **Step 1: Написать падающий тест**

`backend/src/services/__tests__/analytics-service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPnlAnalytics } from '../analytics-service';

const t = (realizedPnlUSD: number, iso: string) => ({
  realizedPnlUSD,
  closedAt: new Date(iso),
});

describe('buildPnlAnalytics', () => {
  it('empty input => empty series and zeroed kpis', () => {
    const out = buildPnlAnalytics([]);
    expect(out.series).toEqual([]);
    expect(out.kpis).toEqual({
      totalPnlUSD: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      bestUSD: 0,
      worstUSD: 0,
    });
  });

  it('single trade => single cumulative point', () => {
    const out = buildPnlAnalytics([t(5, '2026-06-01T00:00:00Z')]);
    expect(out.series).toEqual([{ t: '2026-06-01T00:00:00.000Z', cumulativePnlUSD: 5 }]);
    expect(out.kpis.totalPnlUSD).toBe(5);
    expect(out.kpis.trades).toBe(1);
    expect(out.kpis.wins).toBe(1);
    expect(out.kpis.winRate).toBe(1);
  });

  it('accumulates in closedAt order even when input is unordered', () => {
    const out = buildPnlAnalytics([
      t(10, '2026-06-03T00:00:00Z'),
      t(-4, '2026-06-01T00:00:00Z'),
      t(6, '2026-06-02T00:00:00Z'),
    ]);
    expect(out.series.map((p) => p.cumulativePnlUSD)).toEqual([-4, 2, 12]);
    expect(out.series[0].t).toBe('2026-06-01T00:00:00.000Z');
  });

  it('mixed win/loss/zero => correct kpis (zero is neither win nor loss)', () => {
    const out = buildPnlAnalytics([
      t(8, '2026-06-01T00:00:00Z'),
      t(-3, '2026-06-02T00:00:00Z'),
      t(0, '2026-06-03T00:00:00Z'),
    ]);
    expect(out.kpis).toEqual({
      totalPnlUSD: 5,
      trades: 3,
      wins: 1,
      losses: 1,
      winRate: 1 / 3,
      bestUSD: 8,
      worstUSD: -3,
    });
  });

  it('all losses => best is the least-bad (still negative)', () => {
    const out = buildPnlAnalytics([
      t(-2, '2026-06-01T00:00:00Z'),
      t(-9, '2026-06-02T00:00:00Z'),
    ]);
    expect(out.kpis.bestUSD).toBe(-2);
    expect(out.kpis.worstUSD).toBe(-9);
    expect(out.kpis.wins).toBe(0);
    expect(out.kpis.losses).toBe(2);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd backend && npx vitest run src/services/__tests__/analytics-service.test.ts`
Expected: FAIL — `buildPnlAnalytics` не определена / модуль не найден.

- [ ] **Step 3: Реализовать функцию**

`backend/src/services/analytics-service.ts`:

```ts
import { Trade } from '../models/trade-model';

export interface PnlPoint {
  t: string; // ISO closedAt
  cumulativePnlUSD: number;
}

export interface PnlKpis {
  totalPnlUSD: number;
  trades: number;
  wins: number; // realizedPnlUSD > 0
  losses: number; // realizedPnlUSD < 0
  winRate: number; // wins / trades, 0 when trades === 0
  bestUSD: number; // max realizedPnlUSD, 0 when empty
  worstUSD: number; // min realizedPnlUSD, 0 when empty
}

export interface PnlAnalytics {
  series: PnlPoint[];
  kpis: PnlKpis;
}

type TradeLike = Pick<Trade, 'realizedPnlUSD' | 'closedAt'>;

export function buildPnlAnalytics(trades: TradeLike[]): PnlAnalytics {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
  );

  let cumulative = 0;
  const series: PnlPoint[] = sorted.map((trade) => {
    cumulative += trade.realizedPnlUSD;
    return { t: new Date(trade.closedAt).toISOString(), cumulativePnlUSD: cumulative };
  });

  const pnls = sorted.map((trade) => trade.realizedPnlUSD);
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const trades_ = sorted.length;

  return {
    series,
    kpis: {
      totalPnlUSD: cumulative,
      trades: trades_,
      wins,
      losses,
      winRate: trades_ === 0 ? 0 : wins / trades_,
      bestUSD: pnls.length ? Math.max(...pnls) : 0,
      worstUSD: pnls.length ? Math.min(...pnls) : 0,
    },
  };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `cd backend && npx vitest run src/services/__tests__/analytics-service.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Коммит**

```bash
git add backend/src/services/analytics-service.ts backend/src/services/__tests__/analytics-service.test.ts
git commit -m "feat(analytics): pure buildPnlAnalytics with unit tests"
```

---

### Task 2: Контроллер и роут `GET /analytics/pnl` (backend)

**Files:**
- Create: `backend/src/controllers/analytics-controller.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Реализовать контроллер**

`backend/src/controllers/analytics-controller.ts`:

```ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import positionService from '../services/position-service';
import { buildPnlAnalytics } from '../services/analytics-service';

class AnalyticsController {
  async pnl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const trades = await positionService.getTrades(userId);
      return res.json(buildPnlAnalytics(trades));
    } catch (e) {
      next(e);
    }
  }
}

export default new AnalyticsController();
```

- [ ] **Step 2: Зарегистрировать роут**

В `backend/src/routes/index.ts` добавить импорт рядом с прочими контроллерами:

```ts
import AnalyticsController from '../controllers/analytics-controller';
```

И роут рядом с `/positions` и `/trades` (после строки `router.get('/trades', authMiddleware, TradeController.trades);`):

```ts
router.get('/analytics/pnl', authMiddleware, AnalyticsController.pnl);
```

- [ ] **Step 3: Проверить типы**

Run: `cd backend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add backend/src/controllers/analytics-controller.ts backend/src/routes/index.ts
git commit -m "feat(analytics): GET /analytics/pnl endpoint"
```

---

### Task 3: HTTP-интеграционный тест эндпоинта (incl. IDOR)

**Files:**
- Create: `backend/src/controllers/__tests__/analytics.integration.test.ts`

- [ ] **Step 1: Написать тест**

`backend/src/controllers/__tests__/analytics.integration.test.ts` (паттерн взят из `filter.integration.test.ts`):

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import tokenService from '../../services/token-service';
import { UserModel } from '../../models/user-model';
import { TradeModel } from '../../models/trade-model';

let mongod: MongoMemoryServer;

async function makeUser(email: string) {
  const user = await UserModel.create({ email, password: 'x', isActivated: true });
  const { accessToken } = tokenService.generateTokens({
    id: user._id.toString(),
    email,
    isActivated: true,
  });
  return { id: user._id.toString(), token: accessToken };
}

async function addTrade(userId: string, realizedPnlUSD: number, closedAt: string) {
  await TradeModel.create({
    user: userId,
    tokenAddress: 'TokenMint111',
    dexId: 'raydium',
    buyPriceUSD: 1,
    sellPriceUSD: 2,
    amount: 1,
    realizedPnlUSD,
    reason: 'take_profit',
    txId: 'sig',
    closedAt: new Date(closedAt),
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
  await TradeModel.deleteMany({});
});

describe('GET /api/analytics/pnl', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/analytics/pnl');
    expect(res.status).toBe(401);
  });

  it('returns empty analytics when user has no trades', async () => {
    const a = await makeUser('a@e.com');
    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series).toEqual([]);
    expect(res.body.kpis.totalPnlUSD).toBe(0);
    expect(res.body.kpis.trades).toBe(0);
  });

  it('returns cumulative series and kpis for the user', async () => {
    const a = await makeUser('a@e.com');
    await addTrade(a.id, 5, '2026-06-01T00:00:00Z');
    await addTrade(a.id, -2, '2026-06-02T00:00:00Z');
    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series.map((p: { cumulativePnlUSD: number }) => p.cumulativePnlUSD)).toEqual([5, 3]);
    expect(res.body.kpis.totalPnlUSD).toBe(3);
    expect(res.body.kpis.trades).toBe(2);
  });

  it('does not leak another user trades (IDOR)', async () => {
    const a = await makeUser('a@e.com');
    const b = await makeUser('b@e.com');
    await addTrade(b.id, 100, '2026-06-01T00:00:00Z');

    const res = await request(app)
      .get('/api/analytics/pnl')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.series).toEqual([]);
    expect(res.body.kpis.totalPnlUSD).toBe(0);
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd backend && npx vitest run src/controllers/__tests__/analytics.integration.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 3: Прогнать весь backend-набор (регрессий нет)**

Run: `cd backend && npm test`
Expected: все тесты зелёные (прежние 63 + новые).

- [ ] **Step 4: Коммит**

```bash
git add backend/src/controllers/__tests__/analytics.integration.test.ts
git commit -m "test(analytics): HTTP integration + IDOR for /analytics/pnl"
```

---

### Task 4: Frontend — recharts + API-клиент

**Files:**
- Modify: `frontend/package.json` (через npm install)
- Create: `frontend/src/api/analytics-api.ts`

- [ ] **Step 1: Установить recharts**

Run: `cd frontend && npm install recharts`
Expected: `recharts` появляется в `dependencies`, `package-lock.json` обновлён.

- [ ] **Step 2: Создать API-клиент**

`frontend/src/api/analytics-api.ts` (типы зеркалят бэкенд):

```ts
import api from './axiosInstance';

export interface PnlPoint {
  t: string;
  cumulativePnlUSD: number;
}

export interface PnlKpis {
  totalPnlUSD: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  bestUSD: number;
  worstUSD: number;
}

export interface PnlAnalytics {
  series: PnlPoint[];
  kpis: PnlKpis;
}

export const getPnlAnalytics = async (): Promise<PnlAnalytics> => {
  const res = await api.get<PnlAnalytics>('/analytics/pnl');
  return res.data;
};
```

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/analytics-api.ts
git commit -m "feat(analytics): frontend recharts dep + analytics API client"
```

---

### Task 5: Frontend — компоненты KPI и графика

**Files:**
- Create: `frontend/src/components/PnlStats.tsx`
- Create: `frontend/src/components/PnlChart.tsx`

- [ ] **Step 1: KPI-карточки**

`frontend/src/components/PnlStats.tsx`:

```tsx
import { PnlKpis } from '@/api/analytics-api';

/** USD with sign, 2 decimals. Local helper — formatThousands is digits-only. */
const formatUsd = (v: number): string =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PnlStats = ({ kpis }: { kpis: PnlKpis }) => {
  const cards: { label: string; value: string; tone?: 'pos' | 'neg' }[] = [
    { label: 'Итоговый PnL', value: formatUsd(kpis.totalPnlUSD), tone: kpis.totalPnlUSD >= 0 ? 'pos' : 'neg' },
    { label: 'Сделок', value: String(kpis.trades) },
    { label: 'Win-rate', value: `${(kpis.winRate * 100).toFixed(1)}%` },
    { label: 'Лучшая', value: formatUsd(kpis.bestUSD), tone: 'pos' },
    { label: 'Худшая', value: formatUsd(kpis.worstUSD), tone: 'neg' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500">{c.label}</div>
          <div
            className={`text-lg font-semibold ${
              c.tone === 'pos' ? 'text-green-600' : c.tone === 'neg' ? 'text-red-600' : ''
            }`}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PnlStats;
```

- [ ] **Step 2: График кривой накопленного PnL**

`frontend/src/components/PnlChart.tsx`:

```tsx
import { PnlPoint } from '@/api/analytics-api';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PnlChart = ({ series }: { series: PnlPoint[] }) => {
  if (series.length === 0) {
    return (
      <p className="text-gray-500 mb-8">
        Сделок пока нет — график появится после первой закрытой сделки.
      </p>
    );
  }

  const data = series.map((p) => ({
    time: new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pnl: Number(p.cumulativePnlUSD.toFixed(2)),
  }));

  return (
    <div className="w-full h-64 mb-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="pnl" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PnlChart;
```

- [ ] **Step 3: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Коммит**

```bash
git add frontend/src/components/PnlStats.tsx frontend/src/components/PnlChart.tsx
git commit -m "feat(analytics): PnlStats and PnlChart components"
```

---

### Task 6: Frontend — встроить аналитику в DashboardPage

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Импорты**

В начало `frontend/src/pages/DashboardPage.tsx` добавить:

```tsx
import { getPnlAnalytics, PnlAnalytics } from "@/api/analytics-api";
import PnlStats from "@/components/PnlStats";
import PnlChart from "@/components/PnlChart";
```

- [ ] **Step 2: Состояние и загрузка**

Добавить состояние рядом с `positions`/`trades`:

```tsx
const [analytics, setAnalytics] = useState<PnlAnalytics | null>(null);
```

В `load()` расширить `Promise.all`, включив аналитику:

```tsx
const [p, t, a] = await Promise.all([getPositions(), getTrades(), getPnlAnalytics()]);
setPositions(p);
setTrades(t);
setAnalytics(a);
```

(Существующий `catch` логирует ошибку и `setPositions([])` — оставить как есть; `analytics` останется `null` и секция покажет плейсхолдер.)

- [ ] **Step 3: Рендер секции аналитики**

Сразу после `<div className="mt-10">` (перед заголовком «Открытые позиции») вставить:

```tsx
<h1 className="text-green-600 mb-4 font-bold">Аналитика</h1>
{analytics && <PnlStats kpis={analytics.kpis} />}
<PnlChart series={analytics?.series ?? []} />
```

- [ ] **Step 4: Проверить типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat(analytics): render PnL stats and chart on dashboard"
```

---

### Task 7: Финальная верификация

- [ ] **Step 1: Backend — весь набор тестов**

Run: `cd backend && npm test`
Expected: все зелёные.

- [ ] **Step 2: Backend — типы**

Run: `cd backend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Frontend — типы**

Run: `cd frontend && npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 4: Ручная проверка (опционально, требует запущенных API+worker+Mongo)**

1. `docker start solsniper-mongo`, поднять backend (`cd backend && npm run dev`) и frontend (`cd frontend && npm run dev`).
2. Залогиниться, открыть дашборд.
3. Без сделок: секция «Аналитика» показывает нулевые KPI и плейсхолдер графика.
4. (Если есть закрытые сделки в БД) — кривая накопленного PnL и KPI отражают данные.

Примечание: фронтовых юнит-тестов в проекте нет (как и в Sub-project 4) — верификация фронта = `tsc` + визуальная проверка.

---

## Готово, когда

- `buildPnlAnalytics` покрыта unit-тестами; `/analytics/pnl` покрыт HTTP+IDOR тестом.
- `npm test` (backend) зелёный; `tsc --noEmit` чистый с обеих сторон.
- Дашборд показывает KPI-карточки + кривую накопленного PnL (или аккуратный плейсхолдер при отсутствии сделок).
- Изменений в моделях/воркере нет; локальный `user-service.ts` не закоммичен.
