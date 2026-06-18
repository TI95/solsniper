# Под-проект 5: UI управления кошельком — дизайн

Дата: 2026-06-18
Ветка роадмапа: Sub-project 5 (расширенное управление кошельком в профиле).
Предыдущие фазы (1 серверный движок, 4 фильтр, 2/3 аналитика) уже смержены в `main`.

## Контекст и цель

solsniper — кастодиальная серверная торговая платформа (frontend: React+Vite+Tailwind;
backend: Express5+TS+MongoDB). Приватный ключ хранится зашифрованным на сервере
(AES-256-GCM), бот торгует 24/7. Сейчас управление кошельком минимально: вставить
приватный ключ (байты/base58), показать public key, заменить, удалить
(`frontend/src/components/CreateNewWalletBtn.tsx`, экспортируется как `WalletGenerator`,
хотя ничего не генерирует), плюс Start/Stop бота.

Цель этой фазы — полноценное управление кастодиальным кошельком из профиля:
**генерация кошелька на сервере, показ баланса SOL, вывод SOL на внешний адрес,
экспорт приватного ключа.** Две последние операции работают с реальными средствами и
требуют повторного ввода пароля аккаунта.

## Решения (из брейншторма)

- Включаем все четыре возможности: генерация, баланс SOL, вывод, экспорт.
- **Re-auth: и экспорт, и вывод требуют текущий пароль аккаунта** (bcrypt-сверка) —
  defense-in-depth: украденный access-токен не даёт вывести средства или слить ключ.
- Структура — подход A: дополняем существующий wallet-слой, перевод SOL выносим в новый
  `blockchain/transfer.ts`, re-auth — общий хелпер в user-service. Фронт чистим от
  мешанины `CreateNewWalletBtn`/`WalletGenerator`.
- Импорт ключа вставкой остаётся; генерация — в дополнение.

## Существующая инфраструктура (переиспользуем)

- `backend/src/utils/keypair.ts` — `parseSecretKey`, `toStorableSecret`.
- `backend/src/utils/crypto.ts` — `encryptSecret`/`decryptSecret` (AES-256-GCM).
- `backend/src/services/wallet-service.ts` — `saveWallet`, `getPublicView`,
  `loadKeypair`, `setBotEnabled`, `deleteWallet`.
- `backend/src/blockchain/connection.ts` — `getConnection()` (QuickNode RPC, env
  `QUICKNODE_ENDPOINT`).
- `bcrypt.compare(plaintext, user.password)` — уже используется в login (user-service).

## Архитектура

### Backend

**Новый общий re-auth хелпер** в `user-service.ts`:
`async verifyPassword(userId: string, password: string): Promise<boolean>` — грузит
пользователя, возвращает `bcrypt.compare(password, user.password)`. Пароль не логируется.

**`wallet-service.ts` — новые методы:**
- `generateWallet(userId)`: `Keypair.generate()` → `encryptSecret(toStorableSecret(kp))`
  → upsert в `WalletModel` (как `saveWallet`, но ключ генерируется) → `{ publicKey }`.
- `getBalanceLamports(userId)`: грузит pubkey, `getConnection().getBalance(new PublicKey(pubkey))`
  → число lamports. Нет кошелька → бросает (контроллер → 400).
- `exportSecret(userId)`: грузит doc, `decryptSecret(...)` → base58-строка секрета.
  Нет кошелька → бросает.
- `withdraw(userId, destination, lamports)`: грузит keypair, валидирует адрес/сумму,
  вызывает `transferSol`, возвращает `txId`. Валидация суммы — против актуального
  баланса минус `WITHDRAW_FEE_BUFFER_LAMPORTS`.

**`backend/src/blockchain/transfer.ts` (новый):**
`async transferSol(from: Keypair, to: PublicKey, lamports: number): Promise<string>` —
строит `SystemProgram.transfer`, шлёт через `getConnection()` (`sendAndConfirmTransaction`),
возвращает сигнатуру. Изолирован, чтобы wallet-service можно было юнит-тестить с моком.

**`trading-config.ts`:** добавить `WITHDRAW_FEE_BUFFER_LAMPORTS` (резерв под комиссию,
напр. 10000 lamports) — чтобы вывод не падал из-за нехватки на fee и работал «Max».

**`wallet-controller.ts` — новые хендлеры** (паттерн как у существующих: `req.user?.id`,
`next(ApiError...)`, `next(e)`):
- `generate` → `walletService.generateWallet`.
- `balance` → `{ lamports, sol: lamports / 1e9 }`.
- `withdraw` → читает `{ password, destination, amountSol?, max? }`; `verifyPassword` →
  неверный пароль → `ApiError.BadRequest('Invalid password')`; валидирует наличие
  destination и (amountSol>0 либо max); вычисляет lamports (max = balance − buffer) →
  `walletService.withdraw` → `{ txId }`.
- `exportSecret` → читает `{ password }`; `verifyPassword` → `{ secretKey }`.
  Секрет не логируется, не кэшируется на сервере.

**`routes/index.ts`:**
```
router.post('/wallet/generate', authMiddleware, WalletController.generate);
router.get('/wallet/balance', authMiddleware, WalletController.balance);
router.post('/wallet/withdraw', authMiddleware, WalletController.withdraw);
router.post('/wallet/export', authMiddleware, WalletController.exportSecret);
```

### Frontend

- **`wallet-api.ts`** += `generateWallet(): Promise<{publicKey}>`,
  `getBalance(): Promise<{lamports:number; sol:number}>`,
  `withdrawSol(password, destination, amountSol|null, max:boolean): Promise<{txId}>`,
  `exportSecret(password): Promise<{secretKey:string}>`.
- **`WalletPanel.tsx`** (рефактор `CreateNewWalletBtn.tsx`): показывает public key и
  баланс SOL (кнопка «Обновить»), кнопки «Создать новый кошелёк» (генерация),
  поле вставки ключа (импорт), «Удалить кошелёк». Если баланс>0 — предупреждение перед
  генерацией/заменой/удалением (необратимая потеря доступа).
- **`WithdrawForm.tsx`**: поля адрес, сумма (+ кнопка «Max»), пароль; кнопка вывода;
  показывает `txId` (ссылку) или ошибку.
- **`ExportKeyDialog.tsx`**: поле пароля → по успеху раскрывает ключ один раз с
  предупреждением и кнопкой «Скопировать»; ключ держится только в локальном состоянии
  компонента (не redux/localStorage), скрывается по кнопке.
- Всё рендерится на `AccountSettingsPage` рядом с фильтром и Start/Stop. Старый файл
  `CreateNewWalletBtn.tsx` удаляется, импорт в `AccountSettingsPage` обновляется.

## Обработка ошибок

- Неверный пароль (export/withdraw) → 400 «Invalid password».
- Вывод: невалидный/свой адрес, `amountSol ≤ 0`, или сумма > `balance − buffer` → 400 с
  понятным сообщением.
- Нет кошелька (balance/withdraw/export) → 400.
- Ошибки RPC (баланс/перевод) → пробрасываются в error-middleware с сообщением; фронт
  показывает текст ошибки, остальной UI не ломается.
- Секрет и пароль НИКОГДА не логируются и не возвращаются, кроме явного ответа
  `/wallet/export` (секрет) — одноразово.

## Безопасность

- Экспорт и вывод за re-auth (bcrypt пароль) поверх authMiddleware.
- Секрет в ответе `/export` — единственное место, где расшифрованный ключ покидает сервер;
  на фронте живёт только в state компонента, показывается по требованию.
- Scoping строго по `req.user.id` во всех методах — нет IDOR.

## Тестирование

- **Unit** (vitest):
  - `verifyPassword`: верный/неверный пароль, несуществующий пользователь.
  - `walletService.generateWallet`: создаёт документ, public key соответствует
    зашифрованному секрету (decrypt → parseSecretKey → тот же pubkey).
  - `walletService.exportSecret`: после `saveWallet`/`generateWallet` возвращает секрет,
    из которого восстанавливается тот же pubkey.
  - withdraw-валидация: невалидный адрес, amount≤0, amount>balance−buffer → бросает;
    `max` вычисляет `balance − buffer`. `getConnection`/`transferSol` замоканы.
  - Эти unit-тесты добавляются в существующий
    `backend/src/services/__tests__/wallet-service.test.ts`.
- **HTTP-интеграция + IDOR** (supertest на `app.ts`) для всех 4 эндпоинтов: без токена →
  401; операции применяются только к своему кошельку; export/withdraw с неверным паролем →
  400; export с верным паролем возвращает секрет. (Закрывает прежний хвост «нет IDOR-тестов
  для wallet».)
- `tsc --noEmit` чистый на backend и frontend. Фронтовых юнит-тестов в проекте нет —
  верификация фронта = tsc + ручная проверка.

## Затрагиваемые файлы

Новые:
- `backend/src/blockchain/transfer.ts`
- `backend/src/controllers/__tests__/wallet.integration.test.ts`
- `frontend/src/components/WalletPanel.tsx`
- `frontend/src/components/WithdrawForm.tsx`
- `frontend/src/components/ExportKeyDialog.tsx`

Изменяемые:
- `backend/src/services/wallet-service.ts` (generate/balance/export/withdraw)
- `backend/src/services/user-service.ts` (`verifyPassword`)
- `backend/src/controllers/wallet-controller.ts` (4 хендлера)
- `backend/src/routes/index.ts` (4 роута)
- `backend/src/config/trading-config.ts` (`WITHDRAW_FEE_BUFFER_LAMPORTS`)
- `frontend/src/api/wallet-api.ts` (4 клиента)
- `frontend/src/pages/AccountSettingsPage.tsx` (новые компоненты вместо `WalletGenerator`)

Удаляется: `frontend/src/components/CreateNewWalletBtn.tsx`.

Без изменений: модели, воркер, торговый движок.
