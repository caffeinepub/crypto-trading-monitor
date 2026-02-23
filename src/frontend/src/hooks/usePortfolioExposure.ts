import { useMemo } from 'react';
import { PositionWithPrice } from '../types/position';
import { calculatePortfolioExposure } from '../utils/exposureCalculations';
import { PortfolioExposure } from '../types/exposure';

export function usePortfolioExposure(positions: PositionWithPrice[]): PortfolioExposure {
  return useMemo(() => {
    return calculatePortfolioExposure(positions);
  }, [positions]);
}
