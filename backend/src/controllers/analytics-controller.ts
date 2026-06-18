import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import positionService from '../services/position-service';
import { buildPnlAnalytics } from '../services/analytics-service';

class AnalyticsController {
  async pnl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const trades = await positionService.getTrades(userId);
      return res.json(buildPnlAnalytics(trades));
    } catch (e) {
      next(e);
    }
  }
}

export default new AnalyticsController();
