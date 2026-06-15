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
