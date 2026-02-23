import { useQuery } from '@tanstack/react-query';
import { fetchPerpetualPairs } from '../services/binanceApi';

export function useBinancePairs() {
  return useQuery({
    queryKey: ['binance-pairs'],
    queryFn: fetchPerpetualPairs,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 3,
  });
}
