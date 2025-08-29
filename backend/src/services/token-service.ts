import jwt from 'jsonwebtoken';
import { TokenModel } from '../models/token-model';
import dotenv from 'dotenv';
dotenv.config();
interface TokenPayload {
    id: string;
    email: string;
    isActivated: boolean;
}

const accesTokenEnv = process.env.JWT_ACCESS_SECRET;
if (!accesTokenEnv) {
    throw new Error('JWT_ACCESS_SECRET is not defined in .env');
}

const refreshTokenEnv = process.env.JWT_REFRESH_SECRET;
if (!refreshTokenEnv) {
    throw new Error('JWT_ACCESS_SECRET is not defined in .env');

}

class TokenService {


    generateTokens(payload: TokenPayload) {
        const accessToken = jwt.sign(payload, accesTokenEnv as string, { expiresIn: '15m' });
        const refreshToken = jwt.sign(payload, refreshTokenEnv as string, { expiresIn: '30d' });
        return {
            accessToken,
            refreshToken
        };
    }

    validateAccessToken(token: string) {
        try {
            const userData = jwt.verify(token, accesTokenEnv as string);
            if (!userData || typeof userData !== 'object' || !('id' in userData) || !('email' in userData)) {
                console.error('Invalid access token payload:', userData);
                return null;
            }
            return userData as TokenPayload;
        } catch (e) {
            console.error('Access token validation failed:', e);
            return null;
        }
    }

    validateRefreshToken(token: string) {
        try {
            const userData = jwt.verify(token, refreshTokenEnv as string);
            if (!userData || typeof userData !== 'object' || !('id' in userData) || !('email' in userData)) {
                console.error('Invalid refresh token payload:', userData);
                return null;
            }
            return userData as TokenPayload;
        } catch (e) {
            console.error('Refresh token validation failed:', e);
            return null;
        }
    }

    async saveToken(userId: string, refreshToken: string) {
        const tokenData = await TokenModel.findOne({ user: userId });
        if (tokenData) {
            tokenData.refreshToken = refreshToken;
            return tokenData.save();
        }
        const token = await TokenModel.create({ user: userId, refreshToken });
        return token;
    }

    async removeToken(refreshToken: string) {
        const tokenData = await TokenModel.deleteOne({ refreshToken });
        return tokenData;
    }

    async findToken(refreshToken: string) {
        const tokenData = await TokenModel.findOne({ refreshToken });
        return tokenData;
    }
}


export default new TokenService();


//Сейчас один refreshToken при вхоже с другого устройства перезаписывается и удаляется старый, значит надо продумать как хранить несколько токенов для одного пользователя
// Так же нужен механизм для удаления старых токенов, которые уже не используются