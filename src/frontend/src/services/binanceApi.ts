export interface BinanceSymbol {
  symbol: string;
  contractType: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface BinanceExchangeInfo {
  symbols: BinanceSymbol[];
}

export interface BinanceTicker {
  symbol: string;
  price: string;
}

const BINANCE_FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';

export async function fetchPerpetualPairs(): Promise<string[]> {
  try {
    const response = await fetch(`${BINANCE_FUTURES_BASE}/exchangeInfo`);
    if (!response.ok) {
      throw new Error('Failed to fetch exchange info');
    }
    const data: BinanceExchangeInfo = await response.json();
    
    const perpetualPairs = data.symbols
      .filter(s => s.contractType === 'PERPETUAL' && s.status === 'TRADING')
      .map(s => s.symbol)
      .sort();
    
    return perpetualPairs;
  } catch (error) {
    console.error('Error fetching perpetual pairs:', error);
    throw new Error('Unable to fetch trading pairs from Binance');
  }
}

export async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const response = await fetch(`${BINANCE_FUTURES_BASE}/ticker/price?symbol=${symbol}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
    const data: BinanceTicker = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    throw error;
  }
}

export async function fetchKlines(symbol: string, interval: string = '1h', limit: number = 100): Promise<number[]> {
  try {
    const response = await fetch(
      `${BINANCE_FUTURES_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch klines for ${symbol}`);
    }
    const data = await response.json();
    // Extract close prices
    return data.map((kline: any[]) => parseFloat(kline[4]));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
}
