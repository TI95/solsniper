import { UserModel } from '../models/user-model';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; import mailService from './mail-service';
import tokenService from './token-service';
import UserDto from '../dtos/user-dto';
import ApiError from '../exceptions/api-errors';


class UserService {

    async registration(email: string, password: string) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest('User with this email already exists');
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuidv4();


        const user = await UserModel.create({ email, password: hashPassword, activationLink });
        await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);

        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(user._id.toString(), tokens.refreshToken);

        return { ...tokens, user: userDto };
    }

    async activate(activationLink: string) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest('Пользователь с такой ссылкой не найден');
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email: string, password: string) {
        const user = await UserModel.findOne({ email });
        console.log(user);
        if (!user) {
            throw ApiError.BadRequest('User with this email not found');
        }
        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('Incorrect email or password');
        }
        if (!user.isActivated) {
            throw ApiError.BadRequest('Check email and activate you acc.');
        }
        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(user._id.toString(), tokens.refreshToken);

        return { ...tokens, user: userDto };
    }

    async logout(refreshToken: string) {
        const token = await tokenService.removeToken(refreshToken);
        return token;
    }

async refresh(refreshToken: string) {
  if (!refreshToken) {
    console.error('Refresh: No refreshToken provided');
    throw ApiError.UnauthorizedError();
  }
  const userData = tokenService.validateRefreshToken(refreshToken);
  if (!userData) {
    console.error('Refresh: Invalid refreshToken:', refreshToken);
    throw ApiError.UnauthorizedError();
  }
  const tokenFromDb = await tokenService.findToken(refreshToken);
  if (!tokenFromDb) {
    console.error('Refresh: Token not found in DB:', refreshToken);
    throw ApiError.UnauthorizedError();
  }
  const user = await UserModel.findById(userData.id);
  if (!user) {
    console.error('Refresh: User not found for ID:', userData.id);
    throw ApiError.UnauthorizedError();
  }
  const userDto = new UserDto(user);
  const tokens = tokenService.generateTokens({ ...userDto });
  // Проверяем, действителен ли текущий токен
  const existingToken = tokenService.validateRefreshToken(tokenFromDb.refreshToken);
  if (existingToken) {
    console.log('Refresh: Keeping existing valid refreshToken:', tokenFromDb.refreshToken);
    return { accessToken: tokens.accessToken, refreshToken: tokenFromDb.refreshToken, user: userDto };
  }
  await tokenService.saveToken(user._id.toString(), tokens.refreshToken);
  console.log('Refresh: New tokens generated:', tokens);
  return { ...tokens, user: userDto };
}
}

export default new UserService();