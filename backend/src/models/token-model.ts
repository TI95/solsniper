import { Schema, model, Document, Types } from 'mongoose';
import { User } from './user-model';

export interface Token extends Document {
  user: User;
  refreshToken: string;
}

const TokenSchema = new Schema<Token>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  refreshToken: { type: String, required: true },
});

export const TokenModel = model<Token>('Token', TokenSchema);
