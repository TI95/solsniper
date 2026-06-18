import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import walletService from '../services/wallet-service';
import filterConfigService from '../services/filter-config-service';

class WalletController {
  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { secretKey } = req.body;
      if (!secretKey || typeof secretKey !== 'string') {
        return next(ApiError.BadRequest('secretKey is required'));
      }
      try {
        const result = await walletService.saveWallet(userId, secretKey);
        return res.json(result);
      } catch {
        return next(ApiError.BadRequest('Invalid secret key'));
      }
    } catch (e) {
      next(e);
    }
  }

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      return res.json(view);
    } catch (e) {
      next(e);
    }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      await walletService.deleteWallet(userId);
      return res.json({ message: 'Wallet removed' });
    } catch (e) {
      next(e);
    }
  }

  async startBot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('Add a wallet before starting the bot'));
      if (!(await filterConfigService.hasForUser(userId))) {
        return next(ApiError.BadRequest('Configure a filter before starting the bot'));
      }
      await walletService.setBotEnabled(userId, true);
      return res.json({ botEnabled: true });
    } catch (e) {
      next(e);
    }
  }

  async stopBot(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      await walletService.setBotEnabled(userId, false);
      return res.json({ botEnabled: false });
    } catch (e) {
      next(e);
    }
  }
}

export default new WalletController();
