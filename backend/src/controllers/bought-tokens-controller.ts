import { Request, Response, NextFunction } from "express";
import tokensDataService from "../services/tokens-data-service";
import { validationResult } from "express-validator";
import ApiError from "../exceptions/api-errors";
import { AuthRequest } from "../middleware/auth-middleware";  

class TokensDataController {
    async saveTokensData(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Проверка валидации входных данных
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest("Validation error", errors.array()));
            }

            const userId = req.user?.id;
            if (!userId) {
                return next(ApiError.UnauthorizedError());
            }

            const {
                totalCost,
                amount,
                amountInLamports,
                decimals,
                buyPriceInUSD,
                dexId,
            } = req.body;

             
            if (
                !totalCost ||
                !amount ||
                !amountInLamports ||
                !decimals ||
                !buyPriceInUSD ||
                !dexId
            ) {
                return next(ApiError.BadRequest("Missing required fields"));
            }

             
            const tokenData = {
                totalCost,
                amount,
                amountInLamports,
                decimals,
                buyPriceInUSD,
                dexId,
            };

             
            const savedToken = await tokensDataService.saveBoughtToken(
                userId,
                tokenData
            );

            // Ответ клиенту
            return res.json({
                message: "Token data saved successfully",
                data: savedToken,
            });
        } catch (e) {
            next(e);
        }
    }

    async getTokensData(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Получение userId из req.user
            const userId = req.user?.id;
            if (!userId) {
                return next(ApiError.UnauthorizedError());
            }

            // Получение всех токенов пользователя
            const tokens = await tokensDataService.getAllBoughtTokens(userId);

            // Ответ клиенту
            return res.json({
                message: "Tokens retrieved successfully",
                data: tokens,
            });
        } catch (e) {
            next(e);
        }
    }
}

export default new TokensDataController();