import { useQuery } from '@tanstack/react-query';

const FAPI_BASE = 'https://fapi.binance.com/fapi/v1';

interface BinancePerpetualPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
}

async function fetchPerpetualPairs(): Promise<string[]> {
  const response = await fetch(`${FAPI_BASE}/exchangeInfo`);
  if (!response.ok) throw new Error('Failed to fetch exchange info from Binance');
  const data = await response.json();
  return (data.symbols as BinancePerpetualPair[])
    .filter((s) => s.contractType === 'PERPETUAL' && s.status === 'TRADING')
    .map((s) => s.symbol)
    .sort();
}

export function useBinancePairs() {
  return useQuery({
    queryKey: ['binance-pairs'],
    queryFn: fetchPerpetualPairs,
    staleTime: 1000 * 60 * 60,
    retry: 3,
  });
}
