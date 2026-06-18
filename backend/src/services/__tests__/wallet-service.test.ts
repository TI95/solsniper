import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import walletService from '../wallet-service';
import { WalletModel } from '../../models/wallet-model';
import { parseSecretKey } from '../../utils/keypair';

vi.mock('../../blockchain/connection', () => ({ getConnection: vi.fn() }));
vi.mock('../../blockchain/transfer', () => ({ transferSol: vi.fn() }));
import { getConnection } from '../../blockchain/connection';
import { transferSol } from '../../blockchain/transfer';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../../config/trading-config';

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
  vi.clearAllMocks();
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
});
