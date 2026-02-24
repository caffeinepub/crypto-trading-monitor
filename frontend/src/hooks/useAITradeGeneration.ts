import { useQuery } from '@tanstack/react-query';
import { AITrade, TradingModality } from '../types/aiTrade';
import { useAITradeStorage } from './useAITradeStorage';
import { generateAITradeForModality } from '../utils/aiTradeSelection';
import { getTotalCapital } from '../utils/totalCapitalStorage';

const MODALITIES: TradingModality[] = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];
const DEFAULT_INVESTMENT_PER_MODALITY = 1000;

function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

export function useAITradeGeneration() {
  const { getTrades, saveTrades, checkAndResetDaily } = useAITradeStorage();

  const rawCapital = getTotalCapital();
  const totalCapital = rawCapital !== null ? rawCapital : 0;
  const investmentPerModality =
    totalCapital > 0 ? totalCapital / 4 : DEFAULT_INVESTMENT_PER_MODALITY;

  return useQuery<AITrade[]>({
    queryKey: ['ai-daily-trades', getTodayUTC(), totalCapital],
    queryFn: async () => {
      const needsGeneration = checkAndResetDaily();

      if (!needsGeneration) {
        const stored = getTrades();
        if (stored && stored.length > 0) return stored;
      }

      const trades: AITrade[] = [];
      for (const modality of MODALITIES) {
        try {
          const trade = await generateAITradeForModality(modality, investmentPerModality);
          if (trade) trades.push(trade);
        } catch (err) {
          console.error(`Failed to generate trade for ${modality}:`, err);
          // Skip failed modality — don't abort the whole generation
        }
      }

      if (trades.length === 0) {
        throw new Error('Failed to generate any AI trades. Please check your connection.');
      }

      saveTrades(trades);
      return trades;
    },
    // Stable: only refetch when the UTC date changes or capital changes
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
