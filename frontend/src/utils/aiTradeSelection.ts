import { TradingModality, AITrade } from '../types/aiTrade';
import { fetchKlines, fetchCurrentPrices } from '../services/binanceApi';
import { BinanceKline } from '../services/binanceApi';

// --- Technical Indicator Helpers ---

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = prices[0];
  for (let i = 0; i < prices.length; i++) {
    const val = i === 0 ? prices[0] : prices[i] * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcATR(klines: BinanceKline[], period: number = 14): number {
  if (klines.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calcMomentum(closes: number[], period: number = 10): number {
  if (closes.length < period + 1) return 0;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - period];
  return ((current - past) / past) * 100;
}

interface TechnicalIndicators {
  rsi: number;
  atr: number;
  momentum: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  ema9: number;
  ema21: number;
  currentPrice: number;
  signalStrength: number;
}

function computeTechnicalIndicators(klines: BinanceKline[]): TechnicalIndicators {
  const closes = klines.map((k) => k.close);
  const rsi = calcRSI(closes);
  const atr = calcATR(klines);
  const momentum = calcMomentum(closes);
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const currentPrice = closes[closes.length - 1];

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema9 > ema21 && momentum > 0) trend = 'bullish';
  else if (ema9 < ema21 && momentum < 0) trend = 'bearish';

  // Signal strength: 0-100
  let signalStrength = 50;
  if (trend === 'bullish') {
    signalStrength = 50 + Math.min(30, Math.abs(momentum) * 2) + (rsi > 50 ? 10 : -10) + (rsi < 70 ? 10 : -10);
  } else if (trend === 'bearish') {
    signalStrength = 50 + Math.min(30, Math.abs(momentum) * 2) + (rsi < 50 ? 10 : -10) + (rsi > 30 ? 10 : -10);
  }
  signalStrength = Math.min(100, Math.max(0, signalStrength));

  return { rsi, atr, momentum, trend, ema9, ema21, currentPrice, signalStrength };
}

// Modality config
interface ModalityConfig {
  interval: string;
  klineLimit: number;
  leverageMin: number;
  leverageMax: number;
  tpMultiplier1: number;
  tpMultiplier2: number;
  tpMultiplier3: number;
  slMultiplier: number;
}

const MODALITY_CONFIG: Record<TradingModality, ModalityConfig> = {
  Scalping: {
    interval: '5m',
    klineLimit: 100,
    leverageMin: 5,
    leverageMax: 20,
    tpMultiplier1: 0.003,
    tpMultiplier2: 0.006,
    tpMultiplier3: 0.01,
    slMultiplier: 0.005,
  },
  DayTrading: {
    interval: '1h',
    klineLimit: 100,
    leverageMin: 3,
    leverageMax: 10,
    tpMultiplier1: 0.008,
    tpMultiplier2: 0.015,
    tpMultiplier3: 0.025,
    slMultiplier: 0.012,
  },
  SwingTrading: {
    interval: '4h',
    klineLimit: 100,
    leverageMin: 2,
    leverageMax: 5,
    tpMultiplier1: 0.02,
    tpMultiplier2: 0.04,
    tpMultiplier3: 0.07,
    slMultiplier: 0.025,
  },
  TrendFollowing: {
    interval: '1d',
    klineLimit: 60,
    leverageMin: 1,
    leverageMax: 3,
    tpMultiplier1: 0.04,
    tpMultiplier2: 0.08,
    tpMultiplier3: 0.14,
    slMultiplier: 0.05,
  },
};

// Candidate symbols per modality (well-known liquid USDT-M perpetuals)
const CANDIDATE_SYMBOLS: Record<TradingModality, string[]> = {
  Scalping: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  DayTrading: ['BTCUSDT', 'ETHUSDT', 'AVAXUSDT', 'DOGEUSDT', 'LINKUSDT'],
  SwingTrading: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'],
  TrendFollowing: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'MATICUSDT'],
};

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateReasoningSummary(
  symbol: string,
  direction: 'Long' | 'Short',
  indicators: TechnicalIndicators,
  modality: TradingModality
): string {
  const rsiStr = indicators.rsi.toFixed(0);
  const momentumStr = Math.abs(indicators.momentum).toFixed(2);
  const trendStr = indicators.trend === 'bullish' ? 'bullish' : indicators.trend === 'bearish' ? 'bearish' : 'neutral';
  const emaRelation = indicators.ema9 > indicators.ema21 ? 'EMA9 above EMA21 confirms upward momentum' : 'EMA9 below EMA21 signals downward pressure';

  const modalityDesc: Record<TradingModality, string> = {
    Scalping: 'Short-term scalp opportunity detected on 5-minute chart.',
    DayTrading: 'Intraday setup identified on 1-hour timeframe.',
    SwingTrading: 'Multi-day swing setup confirmed on 4-hour chart.',
    TrendFollowing: 'Strong trend continuation signal on daily chart.',
  };

  return `${modalityDesc[modality]} Selected ${symbol} ${direction} based on ${trendStr} market structure with RSI at ${rsiStr}. ${emaRelation} with ${momentumStr}% momentum. ATR-based TP/SL levels set for optimal risk-reward ratio.`;
}

const DEFAULT_INVESTMENT = 1000;

/**
 * Generate an AI trade for a given modality.
 * @param modality - The trading modality to generate a trade for.
 * @param investmentAmount - Optional investment amount (defaults to $1,000 if not provided).
 */
export async function generateAITradeForModality(
  modality: TradingModality,
  investmentAmount?: number
): Promise<AITrade> {
  const config = MODALITY_CONFIG[modality];
  const candidates = CANDIDATE_SYMBOLS[modality];
  const investment = investmentAmount !== undefined && investmentAmount > 0 ? investmentAmount : DEFAULT_INVESTMENT;

  // Fetch klines for all candidates and score them
  const results: Array<{ symbol: string; indicators: TechnicalIndicators }> = [];

  for (const symbol of candidates) {
    try {
      const klines = await fetchKlines(symbol, config.interval, config.klineLimit);
      if (klines.length < 20) continue;
      const indicators = computeTechnicalIndicators(klines);
      results.push({ symbol, indicators });
    } catch {
      // skip failed symbols
    }
  }

  if (results.length === 0) {
    throw new Error(`No valid candidates found for ${modality}`);
  }

  // Pick the symbol with the highest signal strength
  results.sort((a, b) => b.indicators.signalStrength - a.indicators.signalStrength);
  const best = results[0];

  // Fetch current price
  const prices = await fetchCurrentPrices([best.symbol]);
  const currentPrice = prices.length > 0 ? parseFloat(prices[0].price) : best.indicators.currentPrice;

  const direction: 'Long' | 'Short' = best.indicators.trend === 'bearish' ? 'Short' : 'Long';
  const leverage = randomInRange(config.leverageMin, config.leverageMax);

  const atrOffset = best.indicators.atr > 0 ? best.indicators.atr : currentPrice * 0.005;

  let tp1: number, tp2: number, tp3: number, stopLoss: number;

  if (direction === 'Long') {
    tp1 = currentPrice * (1 + config.tpMultiplier1) + atrOffset * 0.5;
    tp2 = currentPrice * (1 + config.tpMultiplier2) + atrOffset;
    tp3 = currentPrice * (1 + config.tpMultiplier3) + atrOffset * 1.5;
    stopLoss = currentPrice * (1 - config.slMultiplier) - atrOffset * 0.5;
  } else {
    tp1 = currentPrice * (1 - config.tpMultiplier1) - atrOffset * 0.5;
    tp2 = currentPrice * (1 - config.tpMultiplier2) - atrOffset;
    tp3 = currentPrice * (1 - config.tpMultiplier3) - atrOffset * 1.5;
    stopLoss = currentPrice * (1 + config.slMultiplier) + atrOffset * 0.5;
  }

  const reasoning = generateReasoningSummary(best.symbol, direction, best.indicators, modality);

  return {
    id: `${modality}-${Date.now()}`,
    symbol: best.symbol,
    positionType: direction,
    entryPrice: currentPrice,
    leverage,
    investmentAmount: investment,
    tp1,
    tp2,
    tp3,
    stopLoss,
    status: 'Open',
    timestamp: Date.now(),
    modality,
    reasoning,
    utcDate: new Date().toISOString().split('T')[0],
  };
}
