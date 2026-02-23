import { useQuery } from '@tanstack/react-query';
import { PositionWithPrice } from '../types/position';
import { generateAdjustmentSuggestions } from '../utils/adjustmentSuggestions';
import { AdjustmentSuggestion } from '../types/adjustment';

export function useAdjustmentSuggestions(positions: PositionWithPrice[]) {
  return useQuery<AdjustmentSuggestion[]>({
    queryKey: ['adjustment-suggestions', positions.map(p => p.id).join(',')],
    queryFn: async () => {
      const allSuggestions: AdjustmentSuggestion[] = [];

      for (const position of positions) {
        try {
          // Fetch recent price data
          const response = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${position.symbol}&interval=1h&limit=100`
          );
          const data = await response.json();
          const prices = data.map((k: any) => parseFloat(k[4]));

          const suggestions = generateAdjustmentSuggestions(position, prices);
          allSuggestions.push(...suggestions);
        } catch (error) {
          console.error(`Error generating suggestions for ${position.symbol}:`, error);
        }
      }

      return allSuggestions;
    },
    enabled: positions.length > 0,
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 60000,
  });
}
