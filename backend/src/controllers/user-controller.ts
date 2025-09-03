import { Request, Response, NextFunction } from "express";
import userService from "../services/user-service";
import { validationResult } from "express-validator";
import ApiError from "../exceptions/api-errors";



class UserController {

    async registration(req: Request, res: Response, next: NextFunction) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('Ошибка при валидации', errors.array()));
            }
            const { email, password } = req.body;
            const userData = await userService.registration(email, password);
            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
            });

            return res.json(userData);

        } catch (e) {
            next(e);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;
            const userData = await userService.login(email, password);
            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,

            });

            return res.json(userData);

        } catch (e) {
            next(e);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.cookies;
            console.log('userController: Logout request received, refreshToken:', refreshToken || 'none');
            const token = await userService.logout(refreshToken);
            res.clearCookie('refreshToken');
            console.log('userController: Logout successful, cookie cleared');
            return res.json(token || { message: 'Logout successful' });
        } catch (e) {
            console.error('userController: Logout error:', e);
            next(e);
        }
    }

    async activate(req: Request, res: Response, next: NextFunction) {
        try {

            const activationLink = req.params.link;
            await userService.activate(activationLink);
            const redirectUrl = process.env.ACTIVATION_LINK_CLIENT_URL || 'http://localhost:5173/login';
            return res.redirect(redirectUrl);
        } catch (e) {
            next(e);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {

            const { refreshToken } = req.cookies;
            const userData = await userService.refresh(refreshToken)

            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                sameSite: 'lax',

            });
            return res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    async getUsers(req: Request, res: Response, next: NextFunction) {
        try {
            res.json(['123', '456', '789']);

            // Logic for user registration

        } catch (e) {
            next(e);
        }
    }

}


export default new UserController();
