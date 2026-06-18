import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import walletService from '../services/wallet-service';
import filterConfigService from '../services/filter-config-service';
import userService from '../services/user-service';
import { WITHDRAW_FEE_BUFFER_LAMPORTS } from '../config/trading-config';

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

  async generate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const result = await walletService.generateWallet(userId);
      return res.json(result);
    } catch (e) {
      next(e);
    }
  }

  async balance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('No wallet'));
      const lamports = await walletService.getBalanceLamports(userId);
      return res.json({ lamports, sol: lamports / 1e9 });
    } catch (e) {
      next(e);
    }
  }

  async withdraw(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { password, destination, amountSol, max } = req.body;
      if (!password || typeof password !== 'string') {
        return next(ApiError.BadRequest('password is required'));
      }
      if (!destination || typeof destination !== 'string') {
        return next(ApiError.BadRequest('destination is required'));
      }
      if (!max && !(typeof amountSol === 'number' && amountSol > 0)) {
        return next(ApiError.BadRequest('amountSol must be greater than 0'));
      }
      if (!(await userService.verifyPassword(userId, password))) {
        return next(ApiError.BadRequest('Invalid password'));
      }
      const view = await walletService.getPublicView(userId);
      if (!view) return next(ApiError.BadRequest('No wallet'));

      let lamports: number;
      if (max) {
        const balance = await walletService.getBalanceLamports(userId);
        lamports = balance - WITHDRAW_FEE_BUFFER_LAMPORTS;
        if (lamports <= 0) {
          return next(ApiError.BadRequest('Balance too low to withdraw'));
        }
      } else {
        lamports = Math.round(amountSol * 1e9);
      }

      try {
        const txId = await walletService.withdraw(userId, destination, lamports);
        return res.json({ txId });
      } catch (e: any) {
        // Validation (bad address / amount) and RPC failures both surface as a
        // readable 400 so the frontend can show the message without breaking.
        return next(ApiError.BadRequest(e?.message || 'Withdraw failed'));
      }
    } catch (e) {
      next(e);
    }
  }

  async exportSecret(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        return next(ApiError.BadRequest('password is required'));
      }
      if (!(await userService.verifyPassword(userId, password))) {
        return next(ApiError.BadRequest('Invalid password'));
      }
      try {
        const secretKey = await walletService.exportSecret(userId);
        return res.json({ secretKey });
      } catch {
        return next(ApiError.BadRequest('No wallet to export'));
      }
    } catch (e) {
      next(e);
    }
  }
}

export default new WalletController();
