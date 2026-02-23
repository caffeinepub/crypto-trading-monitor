import { useQuery } from '@tanstack/react-query';
import { fetchKlines } from '../services/binanceApi';
import { analyzeSentiment } from '../utils/sentimentAnalysis';
import { SentimentAnalysis } from '../types/sentiment';

export function useSentimentAnalysis(symbol: string) {
  return useQuery<SentimentAnalysis>({
    queryKey: ['sentiment', symbol],
    queryFn: async () => {
      // Fetch 1-hour klines for sentiment analysis
      const klines = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`
      );
      const data = await klines.json();

      const closePrices = data.map((k: any) => parseFloat(k[4]));
      const volumes = data.map((k: any) => parseFloat(k[5]));

      return analyzeSentiment(closePrices, volumes);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 60000, // Consider stale after 1 minute
  });
}
