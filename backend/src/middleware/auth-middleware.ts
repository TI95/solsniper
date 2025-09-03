import { Request, Response, NextFunction } from "express";
import ApiError from "../exceptions/api-errors";
import tokenService from "../services/token-service";
import UserDto from "../dtos/user-dto";


export interface AuthRequest extends Request {
    user?: UserDto
}

export default function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    try {

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next(ApiError.UnauthorizedError());
        }

        const accessToken = authHeader.split(' ')[1];
        if (!accessToken) {
            return next(ApiError.UnauthorizedError());
        }


        const userData = tokenService.validateAccessToken(accessToken);
        if (!userData) {
            return next(ApiError.UnauthorizedError());
        }

        req.user = userData;
        next();
    } catch (e) {
        return next(ApiError.UnauthorizedError());
    }
}