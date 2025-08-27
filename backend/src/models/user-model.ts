import { Schema, model, Document, Types } from 'mongoose';

export interface User extends Document {
    email: string;
    password: string;
    isActivated?: boolean;
    activationLink?: string;
    _id: string;
}

const UserSchema = new Schema<User>({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isActivated: { type: Boolean, default: false },
    activationLink: { type: String },

});

export const UserModel = model<User>('User', UserSchema); 
