import { useQuery } from '@tanstack/react-query';
import { predictTrend } from '../utils/trendPrediction';
import { TrendPrediction } from '../types/prediction';

export function useTrendPrediction(symbol: string) {
  return useQuery<{ shortTerm: TrendPrediction; mediumTerm: TrendPrediction }>({
    queryKey: ['trend-prediction', symbol],
    queryFn: async () => {
      // Fetch hourly data for short-term prediction
      const hourlyResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`
      );
      const hourlyData = await hourlyResponse.json();
      const hourlyPrices = hourlyData.map((k: any) => parseFloat(k[4]));

      // Fetch daily data for medium-term prediction
      const dailyResponse = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=30`
      );
      const dailyData = await dailyResponse.json();
      const dailyPrices = dailyData.map((k: any) => parseFloat(k[4]));

      return predictTrend(hourlyPrices, dailyPrices);
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 600000, // Consider stale after 10 minutes
  });
}
