import { FilterConfigModel, FilterValues } from '../models/filter-config-model';
import ApiError from '../exceptions/api-errors';

const FIELDS = ['minLiquidityUSD', 'maxMarketCapUSD', 'maxAgeMinutes', 'minBoosts'] as const;

/** Validate raw input into a clean FilterValues, throwing ApiError.BadRequest on any violation. */
export function validateFilterValues(raw: any): FilterValues {
  const out = {} as FilterValues;
  for (const f of FIELDS) {
    const v = raw?.[f];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw ApiError.BadRequest(`${f} must be a finite number`);
    }
    out[f] = v;
  }
  if (out.minLiquidityUSD < 0) throw ApiError.BadRequest('minLiquidityUSD must be >= 0');
  if (out.maxMarketCapUSD <= 0) throw ApiError.BadRequest('maxMarketCapUSD must be > 0');
  if (!Number.isInteger(out.maxAgeMinutes) || out.maxAgeMinutes <= 0) {
    throw ApiError.BadRequest('maxAgeMinutes must be a positive integer');
  }
  if (!Number.isInteger(out.minBoosts) || out.minBoosts < 0) {
    throw ApiError.BadRequest('minBoosts must be a non-negative integer');
  }
  return out;
}

class FilterConfigService {
  // CRUD methods added in Task 2
}

export default new FilterConfigService();
