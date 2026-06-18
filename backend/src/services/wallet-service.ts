import { Keypair, PublicKey } from '@solana/web3.js';
import { WalletModel } from '../models/wallet-model';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { parseSecretKey, toStorableSecret } from '../utils/keypair';
import { getConnection } from '../blockchain/connection';
import { transferSol } from '../blockchain/transfer';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../config/trading-config';

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
