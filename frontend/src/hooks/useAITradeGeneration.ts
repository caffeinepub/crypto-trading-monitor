import { useQuery } from '@tanstack/react-query';
import { AITrade, TradingModality } from '../types/aiTrade';
import { useAITradeStorage } from './useAITradeStorage';
import { generateAITradeForModality } from '../utils/aiTradeSelection';

const MODALITIES: TradingModality[] = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];

export function useAITradeGeneration() {
  const { getTrades, saveTrades, checkAndResetDaily } = useAITradeStorage();

  return useQuery<AITrade[]>({
    queryKey: ['ai-daily-trades'],
    queryFn: async () => {
      // Check if we have fresh trades for today
      const needsGeneration = checkAndResetDaily();
      if (!needsGeneration) {
        const stored = getTrades();
        if (stored && stored.length === 4) return stored;
      }

      // Generate new trades for all modalities
      const trades: AITrade[] = [];
      for (const modality of MODALITIES) {
        try {
          const trade = await generateAITradeForModality(modality);
          trades.push(trade);
        } catch (err) {
          console.error(`Failed to generate trade for ${modality}:`, err);
        }
      }

      if (trades.length === 0) {
        throw new Error('Failed to generate any AI trades. Please check your connection.');
      }

      saveTrades(trades);
      return trades;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
