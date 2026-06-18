import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import userService from '../user-service';
import { UserModel } from '../../models/user-model';

let mongod: MongoMemoryServer;

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
});

describe('user-service.verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const password = 'correct-horse-battery';
    const user = await UserModel.create({
      email: 'a@e.com',
      password: await bcrypt.hash(password, 12),
      isActivated: true,
    });
    expect(await userService.verifyPassword(user._id.toString(), password)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const user = await UserModel.create({
      email: 'a@e.com',
      password: await bcrypt.hash('correct-horse-battery', 12),
      isActivated: true,
    });
    expect(await userService.verifyPassword(user._id.toString(), 'wrong')).toBe(false);
  });

  it('returns false for a non-existent user', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    expect(await userService.verifyPassword(id, 'whatever')).toBe(false);
  });
});
