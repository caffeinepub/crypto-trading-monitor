import { useQuery } from '@tanstack/react-query';
import { AITrade, AITradeWithPrice } from '../types/aiTrade';
import { fetchCurrentPrices } from '../services/binanceApi';
import { calculatePnL } from '../utils/pnlCalculations';

export function useAITradeMonitoring(trades: AITrade[] | undefined) {
  const symbols = trades ? trades.map((t) => t.symbol) : [];

  return useQuery<AITradeWithPrice[]>({
    queryKey: ['ai-trade-prices', symbols.join(',')],
    queryFn: async () => {
      if (!trades || trades.length === 0) return [];

      const prices = await fetchCurrentPrices(symbols);
      const priceMap: Record<string, number> = {};
      for (const p of prices) {
        priceMap[p.symbol] = parseFloat(p.price);
      }

      return trades.map((trade): AITradeWithPrice => {
        const currentPrice = priceMap[trade.symbol] ?? trade.entryPrice;

        // calculatePnL(entryPrice, currentPrice, investmentAmount, leverage, positionType)
        const { pnlUSD, pnlPercent } = calculatePnL(
          trade.entryPrice,
          currentPrice,
          trade.investmentAmount,
          trade.leverage,
          trade.positionType
        );

        // Determine status based on price vs TP/SL
        let status = trade.status;
        if (status === 'Open') {
          if (trade.positionType === 'Long') {
            if (currentPrice >= trade.tp3) status = 'TPHit';
            else if (currentPrice <= trade.stopLoss) status = 'SLHit';
          } else {
            if (currentPrice <= trade.tp3) status = 'TPHit';
            else if (currentPrice >= trade.stopLoss) status = 'SLHit';
          }
        }

        return {
          ...trade,
          currentPrice,
          pnlUsd: pnlUSD,
          pnlPercent,
          status,
        };
      });
    },
    enabled: !!trades && trades.length > 0,
    refetchInterval: 5000,
  });
}
