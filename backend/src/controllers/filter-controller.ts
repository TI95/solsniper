import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth-middleware';
import ApiError from '../exceptions/api-errors';
import filterConfigService from '../services/filter-config-service';

class FilterController {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      return res.json(await filterConfigService.getForUser(userId));
    } catch (e) {
      next(e);
    }
  }

  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(ApiError.UnauthorizedError());
      const saved = await filterConfigService.saveForUser(userId, req.body);
      return res.json(saved);
    } catch (e) {
      next(e); // ApiError.BadRequest from validation -> 400 via errorMiddleware
    }
  }
}

export default new FilterController();
