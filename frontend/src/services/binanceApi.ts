const FAPI_BASE = 'https://fapi.binance.com';
const FAPI_V1 = `${FAPI_BASE}/fapi/v1`;

export interface BinancePerpetualPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
  status: string;
}

export interface BinancePrice {
  symbol: string;
  price: string;
}

export interface BinanceKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface TickerPriceResponse {
  symbol: string;
  price: string;
}

export interface LeverageBracket {
  bracket: number;
  initialLeverage: number;
  notionalCap: number;
  notionalFloor: number;
  maintMarginRatio: number;
  cum: number;
}

export interface LeverageBracketResponse {
  symbol: string;
  brackets: LeverageBracket[];
}

/** Returns all USDT-M perpetual pair symbols as strings (used by PositionEntryForm / useBinancePairs) */
export async function fetchPerpetualPairs(): Promise<string[]> {
  try {
    const response = await fetch(`${FAPI_V1}/exchangeInfo`);
    if (!response.ok) throw new Error('Failed to fetch exchange info');
    const data = await response.json();
    return (data.symbols as BinancePerpetualPair[])
      .filter((s) => s.contractType === 'PERPETUAL' && s.status === 'TRADING')
      .map((s) => s.symbol)
      .sort();
  } catch (error) {
    console.error('Error fetching perpetual pairs:', error);
    throw new Error('Unable to fetch trading pairs from Binance');
  }
}

/** Fetch a single symbol's current price (used by usePositionMonitoring) */
export async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const response = await fetch(`${FAPI_V1}/ticker/price?symbol=${symbol}`);
    if (!response.ok) throw new Error(`Failed to fetch price for ${symbol}`);
    const data: BinancePrice = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
}

/** Fetch live ticker price for a symbol — returns typed TickerPriceResponse */
export async function fetchTickerPrice(symbol: string): Promise<TickerPriceResponse> {
  const response = await fetch(`${FAPI_V1}/ticker/price?symbol=${symbol}`);
  if (!response.ok) throw new Error(`Failed to fetch ticker price for ${symbol}`);
  return response.json() as Promise<TickerPriceResponse>;
}

/** Fetch leverage bracket data for a symbol from Binance public endpoint */
export async function fetchLeverageBracket(symbol: string): Promise<LeverageBracketResponse[]> {
  const response = await fetch(`${FAPI_V1}/leverageBracket?symbol=${symbol}`);
  if (!response.ok) throw new Error(`Failed to fetch leverage bracket for ${symbol}`);
  return response.json() as Promise<LeverageBracketResponse[]>;
}

/** Fetch prices for multiple symbols at once (used by AI trade monitoring) */
export async function fetchCurrentPrices(symbols?: string[]): Promise<BinancePrice[]> {
  try {
    const response = await fetch(`${FAPI_V1}/ticker/price`);
    if (!response.ok) throw new Error('Failed to fetch current prices');
    const data: BinancePrice[] = await response.json();
    if (symbols && symbols.length > 0) {
      const set = new Set(symbols);
      return data.filter((p) => set.has(p.symbol));
    }
    return data;
  } catch (error) {
    console.error('Error fetching current prices:', error);
    throw error;
  }
}

/** Fetch OHLCV klines and return structured BinanceKline objects */
export async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<BinanceKline[]> {
  try {
    const url = `${FAPI_V1}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch klines for ${symbol}`);
    const raw: unknown[][] = await response.json();
    return raw.map((k) => ({
      openTime: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
      closeTime: k[6] as number,
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
}

/** Convenience: extract close prices array from klines (used by TP/SL calculators) */
export function klinesToClosePrices(klines: BinanceKline[]): number[] {
  return klines.map((k) => k.close);
}
