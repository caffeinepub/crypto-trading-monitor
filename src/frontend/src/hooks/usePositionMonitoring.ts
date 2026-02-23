import { useQuery } from '@tanstack/react-query';
import { Position, PositionWithPrice } from '../types/position';
import { fetchCurrentPrice } from '../services/binanceApi';
import { calculatePnL } from '../utils/pnlCalculations';

export function usePositionMonitoring(positions: Position[]) {
  return useQuery({
    queryKey: ['position-monitoring', positions.map(p => p.id).join(',')],
    queryFn: async (): Promise<PositionWithPrice[]> => {
      const pricePromises = positions.map(async (position) => {
        try {
          const currentPrice = await fetchCurrentPrice(position.symbol);
          const { pnlUSD, pnlPercent } = calculatePnL(
            position.entryPrice,
            currentPrice,
            position.investmentAmount,
            position.leverage,
            position.positionType
          );

          const distanceToTP1 = position.takeProfitLevels[0]
            ? ((position.takeProfitLevels[0].price - currentPrice) / currentPrice) * 100
            : 0;

          const distanceToSL = ((position.stopLoss.price - currentPrice) / currentPrice) * 100;

          return {
            ...position,
            currentPrice,
            pnlUSD,
            pnlPercent,
            distanceToTP1,
            distanceToSL,
          };
        } catch (error) {
          console.error(`Error fetching price for ${position.symbol}:`, error);
          return {
            ...position,
            currentPrice: position.entryPrice,
            pnlUSD: 0,
            pnlPercent: 0,
            distanceToTP1: 0,
            distanceToSL: 0,
          };
        }
      });

      return Promise.all(pricePromises);
    },
    enabled: positions.length > 0,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000,
  });
}
