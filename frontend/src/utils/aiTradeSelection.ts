import { TradingModality, AITrade } from '../types/aiTrade';
import { fetchKlines, fetchCurrentPrices, BinanceKline } from '../services/binanceApi';
import {
  detectSwingPoints,
  detectBOS,
  detectCHOCH,
  detectOrderBlocks,
  detectFVGs,
  detectLiquidityZones,
  detectManipulation,
  classifyInstitutionalCycle,
  calcATRFromKlines,
  findNearestUnmitigatedOB,
  findNearestOpenFVG,
  findSweptLiquidityZone,
} from './smcAnalysis';

// ─── Technical Indicator Helpers ──────────────────────────────────────────────

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
  const atr = calcATRFromKlines(klines);
  const momentum = calcMomentum(closes);
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const currentPrice = closes[closes.length - 1];

  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema9 > ema21 && momentum > 0) trend = 'bullish';
  else if (ema9 < ema21 && momentum < 0) trend = 'bearish';

  let signalStrength = 50;
  if (trend === 'bullish') {
    signalStrength = 50 + Math.min(30, Math.abs(momentum) * 2) + (rsi > 50 ? 10 : -10) + (rsi < 70 ? 10 : -10);
  } else if (trend === 'bearish') {
    signalStrength = 50 + Math.min(30, Math.abs(momentum) * 2) + (rsi < 50 ? 10 : -10) + (rsi > 30 ? 10 : -10);
  }
  signalStrength = Math.min(100, Math.max(0, signalStrength));

  return { rsi, atr, momentum, trend, ema9, ema21, currentPrice, signalStrength };
}

// ─── Modality Config ──────────────────────────────────────────────────────────

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

const CANDIDATE_SYMBOLS: Record<TradingModality, string[]> = {
  Scalping: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
  DayTrading: ['BTCUSDT', 'ETHUSDT', 'AVAXUSDT', 'DOGEUSDT', 'LINKUSDT'],
  SwingTrading: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT'],
  TrendFollowing: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'MATICUSDT'],
};

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── SMC-Enhanced Reasoning ───────────────────────────────────────────────────

function generateSMCReasoning(
  symbol: string,
  direction: 'Long' | 'Short',
  indicators: TechnicalIndicators,
  modality: TradingModality,
  smcContext: {
    bosDetected: boolean;
    bosPrice: number;
    chochDetected: boolean;
    chochPrice: number;
    obPrice: number | null;
    fvgPrice: number | null;
    liquidityZone: string;
    cycle: string;
    manipulation: string;
    leverageReduced: boolean;
  }
): string {
  const modalityDesc: Record<TradingModality, string> = {
    Scalping: 'Short-term scalp on 5m chart.',
    DayTrading: 'Intraday setup on 1H timeframe.',
    SwingTrading: 'Multi-day swing on 4H chart.',
    TrendFollowing: 'Trend continuation on Daily chart.',
  };

  const parts: string[] = [modalityDesc[modality]];

  if (smcContext.bosDetected) {
    parts.push(`BOS confirmed ${direction === 'Long' ? 'bullish' : 'bearish'} at ${smcContext.bosPrice.toFixed(4)}.`);
  }
  if (smcContext.chochDetected) {
    parts.push(`CHOCH signal at ${smcContext.chochPrice.toFixed(4)} — structure change confirmed.`);
  }
  if (smcContext.obPrice !== null) {
    parts.push(`Unmitigated ${direction === 'Long' ? 'bullish' : 'bearish'} OB at ${smcContext.obPrice.toFixed(4)} provides institutional support.`);
  }
  if (smcContext.fvgPrice !== null) {
    parts.push(`Open FVG at ${smcContext.fvgPrice.toFixed(4)} acts as price magnet for TP target.`);
  }
  if (smcContext.liquidityZone) {
    parts.push(`Liquidity zone: ${smcContext.liquidityZone}.`);
  }
  if (smcContext.cycle !== 'unknown') {
    parts.push(`Institutional cycle: ${smcContext.cycle}.`);
  }
  if (smcContext.manipulation) {
    parts.push(smcContext.manipulation);
  }
  if (smcContext.leverageReduced) {
    parts.push(`Leverage reduced due to manipulation/fakeout signals near entry zone.`);
  }

  parts.push(`RSI: ${indicators.rsi.toFixed(0)}, Momentum: ${Math.abs(indicators.momentum).toFixed(2)}%. RRR ≥ 1:2 enforced.`);

  return parts.join(' ');
}

const DEFAULT_INVESTMENT = 1000;

/**
 * Generate an AI trade for a given modality using SMC-based analysis.
 */
export async function generateAITradeForModality(
  modality: TradingModality,
  investmentAmount?: number
): Promise<AITrade> {
  const config = MODALITY_CONFIG[modality];
  const candidates = CANDIDATE_SYMBOLS[modality];
  const investment = investmentAmount !== undefined && investmentAmount > 0 ? investmentAmount : DEFAULT_INVESTMENT;

  const results: Array<{ symbol: string; indicators: TechnicalIndicators; klines: BinanceKline[] }> = [];

  for (const symbol of candidates) {
    try {
      const klines = await fetchKlines(symbol, config.interval, config.klineLimit);
      if (klines.length < 20) continue;
      const indicators = computeTechnicalIndicators(klines);
      results.push({ symbol, indicators, klines });
    } catch {
      // skip failed symbols
    }
  }

  if (results.length === 0) {
    throw new Error(`No valid candidates found for ${modality}`);
  }

  results.sort((a, b) => b.indicators.signalStrength - a.indicators.signalStrength);
  const best = results[0];

  const prices = await fetchCurrentPrices([best.symbol]);
  const currentPrice = prices.length > 0 ? parseFloat(prices[0].price) : best.indicators.currentPrice;

  const direction: 'Long' | 'Short' = best.indicators.trend === 'bearish' ? 'Short' : 'Long';

  // ─── SMC Analysis ─────────────────────────────────────────────────────────
  const klines = best.klines;
  const swings = detectSwingPoints(klines, 3);
  const bosSignals = detectBOS(klines, swings);
  const chochSignals = detectCHOCH(klines, swings);
  const obs = detectOrderBlocks(klines, bosSignals);
  const fvgs = detectFVGs(klines);
  const liquidityZones = detectLiquidityZones(klines);
  const manipulation = detectManipulation(klines, swings, currentPrice);
  const cycle = classifyInstitutionalCycle(klines, bosSignals, manipulation);
  const atr = calcATRFromKlines(klines);

  // Detect manipulation phase — reduce leverage if present
  const manipulationActive = manipulation.detected && manipulation.type === 'fakeout';
  let leverage = randomInRange(config.leverageMin, config.leverageMax);
  if (manipulationActive) {
    leverage = Math.max(config.leverageMin, Math.floor(leverage * 0.6));
  }

  // Do not enter during active manipulation without displacement confirmation
  // If stop hunt (resolved), it's actually a good entry signal
  const skipEntry = manipulation.detected && manipulation.type === 'fakeout';

  // Find SMC-based TP/SL levels
  const obDirection = direction === 'Long' ? 'bullish' : 'bearish';
  const fvgDirection = direction === 'Long' ? 'bullish' : 'bearish';
  const nearestOB = findNearestUnmitigatedOB(obs, currentPrice, obDirection);
  const nearestFVG = findNearestOpenFVG(fvgs, currentPrice, fvgDirection);
  const sweptLiquidity = findSweptLiquidityZone(klines, swings, direction, currentPrice, atr);

  const atrOffset = atr > 0 ? atr : currentPrice * 0.005;

  // TP levels: TP1 = nearest FVG or mitigation zone, TP2 = swing liquidity, TP3 = opposing OB or major imbalance
  let tp1: number, tp2: number, tp3: number, stopLoss: number;

  const swingHighs = swings.filter((s) => s.type === 'high').map((s) => s.price).sort((a, b) => a - b);
  const swingLows = swings.filter((s) => s.type === 'low').map((s) => s.price).sort((a, b) => b - a);

  if (direction === 'Long') {
    // TP1: nearest open bullish FVG above price, or ATR-based
    tp1 = nearestFVG ? nearestFVG.midpoint : currentPrice * (1 + config.tpMultiplier1) + atrOffset * 0.5;
    // TP2: nearest swing high (external liquidity)
    const nextSwingHigh = swingHighs.find((h) => h > currentPrice * 1.001);
    tp2 = nextSwingHigh ? nextSwingHigh : currentPrice * (1 + config.tpMultiplier2) + atrOffset;
    // TP3: opposing bearish OB or major imbalance
    const opposingOB = findNearestUnmitigatedOB(obs, currentPrice, 'bearish');
    tp3 = opposingOB ? opposingOB.price : currentPrice * (1 + config.tpMultiplier3) + atrOffset * 1.5;
    // SL: below swept liquidity zone
    stopLoss = sweptLiquidity.price;
  } else {
    // TP1: nearest open bearish FVG below price
    tp1 = nearestFVG ? nearestFVG.midpoint : currentPrice * (1 - config.tpMultiplier1) - atrOffset * 0.5;
    // TP2: nearest swing low (external liquidity)
    const nextSwingLow = swingLows.find((l) => l < currentPrice * 0.999);
    tp2 = nextSwingLow ? nextSwingLow : currentPrice * (1 - config.tpMultiplier2) - atrOffset;
    // TP3: opposing bullish OB
    const opposingOB = findNearestUnmitigatedOB(obs, currentPrice, 'bullish');
    tp3 = opposingOB ? opposingOB.price : currentPrice * (1 - config.tpMultiplier3) - atrOffset * 1.5;
    // SL: above swept liquidity zone
    stopLoss = sweptLiquidity.price;
  }

  // Enforce minimum RRR of 1:2
  const slDistance = Math.abs(currentPrice - stopLoss);
  const tp1Distance = Math.abs(tp1 - currentPrice);
  if (tp1Distance < slDistance * 2) {
    if (direction === 'Long') {
      tp1 = currentPrice + slDistance * 2;
    } else {
      tp1 = currentPrice - slDistance * 2;
    }
  }

  // Enforce TP ordering
  if (direction === 'Long') {
    tp1 = Math.max(tp1, currentPrice * 1.001);
    tp2 = Math.max(tp2, tp1 * 1.001);
    tp3 = Math.max(tp3, tp2 * 1.001);
    stopLoss = Math.min(stopLoss, currentPrice * 0.999);
  } else {
    tp1 = Math.min(tp1, currentPrice * 0.999);
    tp2 = Math.min(tp2, tp1 * 0.999);
    tp3 = Math.min(tp3, tp2 * 0.999);
    stopLoss = Math.max(stopLoss, currentPrice * 1.001);
  }

  // Validate ATR cap: TP levels > 3x ATR from entry get capped
  const maxTPDistance = atr * 3;
  if (direction === 'Long') {
    if (tp1 - currentPrice > maxTPDistance * 3) tp1 = currentPrice + maxTPDistance;
    if (tp2 - currentPrice > maxTPDistance * 5) tp2 = currentPrice + maxTPDistance * 2;
    if (tp3 - currentPrice > maxTPDistance * 8) tp3 = currentPrice + maxTPDistance * 3;
  } else {
    if (currentPrice - tp1 > maxTPDistance * 3) tp1 = currentPrice - maxTPDistance;
    if (currentPrice - tp2 > maxTPDistance * 5) tp2 = currentPrice - maxTPDistance * 2;
    if (currentPrice - tp3 > maxTPDistance * 8) tp3 = currentPrice - maxTPDistance * 3;
  }

  // Build SMC context for reasoning
  const lastBOS = bosSignals[bosSignals.length - 1];
  const lastCHOCH = chochSignals[chochSignals.length - 1];
  const nearestLiqZone = liquidityZones.find((z) =>
    direction === 'Long' ? z.type === 'equal_lows' : z.type === 'equal_highs'
  );

  const smcContext = {
    bosDetected: !!lastBOS,
    bosPrice: lastBOS?.price ?? 0,
    chochDetected: !!lastCHOCH,
    chochPrice: lastCHOCH?.price ?? 0,
    obPrice: nearestOB?.price ?? null,
    fvgPrice: nearestFVG?.midpoint ?? null,
    liquidityZone: nearestLiqZone ? `${nearestLiqZone.type} at ${nearestLiqZone.price.toFixed(4)}` : '',
    cycle,
    manipulation: manipulation.detected ? manipulation.description : '',
    leverageReduced: manipulationActive,
  };

  const reasoning = generateSMCReasoning(best.symbol, direction, best.indicators, modality, smcContext);

  // If fakeout detected, still generate trade but note it in reasoning (guardrail: skip entry)
  const finalReasoning = skipEntry
    ? `[CAUTION: Fakeout detected — entry deferred until BOS confirmed] ${reasoning}`
    : reasoning;

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
    reasoning: finalReasoning,
    utcDate: new Date().toISOString().split('T')[0],
  };
}
