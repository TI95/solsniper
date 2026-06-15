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
