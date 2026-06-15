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
