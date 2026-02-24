import { useQuery } from '@tanstack/react-query';
import { AITrade, TradingModality } from '../types/aiTrade';
import { useAITradeStorage } from './useAITradeStorage';
import { generateAITradeForModality } from '../utils/aiTradeSelection';
import { getTotalCapital } from '../utils/totalCapitalStorage';

const MODALITIES: TradingModality[] = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];
const DEFAULT_INVESTMENT_PER_MODALITY = 1000;

export function useAITradeGeneration() {
  const { getTrades, saveTrades, checkAndResetDaily } = useAITradeStorage();

  // Read total capital to use as query key dependency so trades regenerate when capital changes
  const totalCapital = getTotalCapital();
  const investmentPerModality =
    totalCapital !== null && totalCapital > 0
      ? totalCapital / 4
      : DEFAULT_INVESTMENT_PER_MODALITY;

  return useQuery<AITrade[]>({
    queryKey: ['ai-daily-trades', totalCapital],
    queryFn: async () => {
      // Check if we need a full daily reset
      const needsGeneration = checkAndResetDaily();

      if (!needsGeneration) {
        // Return stored trades (may include intra-day replacements)
        const stored = getTrades();
        if (stored && stored.length > 0) return stored;
      }

      // Generate new trades for all modalities (daily reset or first run)
      const trades: AITrade[] = [];
      for (const modality of MODALITIES) {
        try {
          const trade = await generateAITradeForModality(modality, investmentPerModality);
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
    // Use a short stale time so invalidation from monitoring hook triggers a re-fetch
    staleTime: 1000 * 30, // 30 seconds — allows monitoring hook invalidation to propagate quickly
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
