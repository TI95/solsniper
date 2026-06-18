# Под-проекты 2/3: Аналитика / PnL — дизайн

Дата: 2026-06-18
Ветка роадмапа: Sub-projects 2 (финализация модели данных) + 3 (аналитика/PnL).
Предыдущие фазы (1 серверный движок, 4 редактируемый фильтр) уже смержены в `main`.

## Контекст и цель

solsniper — кастодиальный серверный торговый бот (frontend: React+Vite+Tailwind;
backend: Express5+TS+MongoDB). Движок торгует per-user, закрытые сделки пишутся в
коллекцию `Trade` с полем `realizedPnlUSD`. Сейчас на `DashboardPage` есть список
открытых позиций и таблица закрытых сделок, но **нет графика прибыли/убытка**.

Цель этой фазы: показать пользователю **кривую накопленного реализованного PnL во
времени** и **сводные KPI** по его торговле.

## Ключевое решение по объёму (из брейншторма)

Кривая «общей стоимости кошелька» реализуется как **стартовый капитал + накопленный
реализованный PnL**, БЕЗ чтений с блокчейна. То есть:

- **Снапшот-воркер НЕ создаётся** в этой фазе.
- Он-чейн оценка (SOL-баланс + mark-to-market открытых позиций) — осознанно отложена
  на будущее; когда дойдёт, получит собственную модель снапшотов и фоновый воркер.
- Весь ряд строится из существующей коллекции `Trade`.

Следствие: Sub-project 2 («добить модель данных под аналитику») для выбранного подхода
**не требует изменений схемы** — у `Trade` уже есть `user`, `realizedPnlUSD`, `closedAt`
(+ индекс `{ user: 1, closedAt: -1 }`). Изменений в `Position`/`Wallet` тоже не нужно.

## Что показываем (из брейншторма)

1. **Кривая накопленного PnL** — основной график (area/line) по `closedAt` сделок.
2. **KPI-карточки** — сводка числами.

Вне объёма: столбцы PnL по отдельным сделкам; отдельный роут-страница (аналитика живёт
секцией на дашборде); он-чейн баланс и mark-to-market открытых позиций.

## Архитектура

Выбран подход **A — аналитический эндпоинт на бэкенде** (единый источник правды,
тестируемая чистая функция, backend-тесты + IDOR-покрытие). Вариант «считать на фронте
из `/trades`» отклонён: логика PnL расползлась бы в UI и не покрывалась бы backend-тестами.

### Backend

**`backend/src/services/analytics-service.ts`** — чистая функция:

```ts
interface PnlPoint { t: string; cumulativePnlUSD: number }   // t — ISO closedAt
interface PnlKpis {
  totalPnlUSD: number;
  trades: number;
  wins: number;        // realizedPnlUSD > 0
  losses: number;      // realizedPnlUSD < 0
  winRate: number;     // wins / trades, 0 при trades === 0
  bestUSD: number;     // max realizedPnlUSD, 0 при пустом
  worstUSD: number;    // min realizedPnlUSD, 0 при пустом
}
interface PnlAnalytics { series: PnlPoint[]; kpis: PnlKpis }

function buildPnlAnalytics(trades: Pick<Trade, 'realizedPnlUSD' | 'closedAt'>[]): PnlAnalytics
```

Поведение:
- Сортирует сделки по `closedAt` по возрастанию (не полагается на порядок из БД).
- `series`: по точке на сделку, `cumulativePnlUSD` — нарастающая сумма `realizedPnlUSD`.
- `kpis`: агрегаты по тем же сделкам. Сделка с `realizedPnlUSD === 0` не win и не loss.
- Пустой вход → `{ series: [], kpis: { все нули } }`.

**`backend/src/controllers/analytics-controller.ts`** — `pnl(req, res, next)`:
- `userId = req.user?.id`; нет → `UnauthorizedError`.
- Тянет сделки пользователя (через `positionService.getTrades(userId)` или прямой
  `TradeModel.find({ user: userId })`), прогоняет `buildPnlAnalytics`, отдаёт JSON.

**Роут:** `GET /analytics/pnl`, `authMiddleware`, scoped строго по `req.user.id` (без IDOR).

### Frontend

- Зависимость: добавить **`recharts`** (графической либы в проекте сейчас нет).
- **`frontend/src/api/analytics-api.ts`** — `getPnlAnalytics(): Promise<PnlAnalytics>` +
  типы `PnlPoint`/`PnlKpis`/`PnlAnalytics`, зеркалящие backend.
- **`frontend/src/components/PnlChart.tsx`** — area/line кривой `cumulativePnlUSD` по `t`.
  Пустой ряд → аккуратный плейсхолдер «Сделок пока нет».
- **`frontend/src/components/PnlStats.tsx`** — KPI-карточки; USD через существующий
  number-format helper.
- **`DashboardPage.tsx`** — рендерит `PnlStats` + `PnlChart` секцией сверху, над
  открытыми позициями. Данные грузятся в существующем `useEffect`/`setInterval` (10с):
  добавить `getPnlAnalytics()` в `Promise.all` рядом с `getPositions`/`getTrades`.

## Базовая линия кривой

Кривая стартует с **0** — это чистый накопленный реализованный PnL. «Стартовый капитал»
был бы лишь аддитивным сдвигом по оси Y; данных о депозитах в системе нет, поэтому
настраиваемый baseline добавим позже (или вместе с он-чейн оценкой). Это явное допущение
данной фазы.

## Обработка ошибок

- Бэкенд: ошибки уходят в `next(e)` → существующий error-middleware (как в остальных
  контроллерах). Нет сделок — валидный ответ с пустым рядом, не ошибка.
- Фронт: ошибка загрузки логируется в консоль (как сейчас в `DashboardPage`), график
  показывает плейсхолдер; остальной дашборд не ломается.

## Тестирование

- **Unit** (`analytics-service`): пустой вход; одна сделка; несколько (проверка
  накопления и порядка по `closedAt` при перемешанном входе); все плюсовые; микс
  плюс/минус/ноль; корректность `winRate`/`bestUSD`/`worstUSD`.
- **HTTP-интеграция** (`/analytics/pnl` через supertest на `app.ts`): авторизованный
  запрос отдаёт ряд+KPI; **IDOR** — пользователь видит только свои сделки, не чужие;
  без токена → 401.
- `tsc --noEmit` чистый на backend и frontend.

## Затрагиваемые файлы

Новые:
- `backend/src/services/analytics-service.ts`
- `backend/src/controllers/analytics-controller.ts`
- `backend/src/services/__tests__/analytics-service.test.ts`
- `backend/src/controllers/__tests__/analytics.integration.test.ts` (рядом с `filter.integration.test.ts`)
- `frontend/src/api/analytics-api.ts`
- `frontend/src/components/PnlChart.tsx`
- `frontend/src/components/PnlStats.tsx`

Изменяемые:
- `backend/src/routes/index.ts` (роут `GET /analytics/pnl`)
- `frontend/src/pages/DashboardPage.tsx` (секция аналитики + загрузка)
- `frontend/package.json` (recharts)

Без изменений: модели `Trade`/`Position`/`Wallet`, воркер.
