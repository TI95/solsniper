import { Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import walletService from '../services/wallet-service';
import positionService from '../services/position-service';
import { raydiumSell } from '../blockchain/raydium';
import { pumpfunSwap } from '../blockchain/pumpfun';
import { getTokenPrice } from '../services/birdeye-service';
import { PositionModel } from '../models/position-model';

class TradeController {
  async manualSell(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());

      const { tokenAddress, amount, platform } = req.body as {
        tokenAddress?: string;
        amount?: number;
        platform?: 'raydium' | 'pumpfun';
      };
      if (!tokenAddress || !amount || !platform) {
        return next(ApiError.BadRequest('tokenAddress, amount and platform are required'));
      }

      const owner = await walletService.loadKeypair(userId);
      if (!owner) return next(ApiError.BadRequest('No wallet configured'));

      let txId = '';
      if (platform === 'raydium') {
        const lamports = Math.round(amount * 1_000_000_000);
        txId = await raydiumSell(owner, tokenAddress, lamports);
      } else {
        txId = await pumpfunSwap(owner, tokenAddress, Math.floor(amount), 'sell');
      }

      // Best-effort: close a matching open position recording a manual trade.
      const open = await PositionModel.findOne({ user: userId, status: 'open', tokenAddress });
      if (open) {
        const price = await getTokenPrice(tokenAddress);
        await positionService.closePosition(open.id, price.value, 'manual', txId);
      }

      return res.json({ message: 'Sell submitted', txId });
    } catch (e: any) {
      return next(ApiError.BadRequest(`Sell failed: ${e?.message || e}`));
    }
  }

  async positions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await positionService.getOpenPositions(userId));
    } catch (e) {
      next(e);
    }
  }

  async trades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await positionService.getTrades(userId));
    } catch (e) {
      next(e);
    }
  }
}

export default new TradeController();
