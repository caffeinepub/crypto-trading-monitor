/**
 * Market Reversal Detection Algorithm — SMC Enhanced
 *
 * Analyzes Binance kline data to identify trend reversals using:
 * 1. RSI divergence detection
 * 2. EMA crossover signals
 * 3. Candlestick pattern recognition
 * 4. ATR-based volatility spike detection
 * 5. Support/resistance zone violations
 * 6. CHOCH (Change of Character) detection [SMC]
 * 7. Breaker Block detection [SMC]
 * 8. Liquidity sweep without BOS continuation [SMC]
 * 9. Opposing FVG detection [SMC]
 */

import { fetchKlines, BinanceKline } from '../services/binanceApi';
import { calculateATR, findSupportResistance } from './technicalAnalysis';
import { TradingModality } from '../types/aiTrade';
import {
  ReversalSignal,
  RSIDivergence,
  EMACrossover,
  CandlestickPattern,
  VolatilitySpike,
  SupportResistanceViolation,
} from '../types/reversal';
import {
  detectSwingPoints,
  detectBOS,
  detectCHOCH,
  detectOrderBlocks,
  detectFVGs,
  calcATRFromKlines,
  findNearestOpenFVG,
} from './smcAnalysis';

// ─── Timeframe configuration per modality ────────────────────────────────────

interface ModalityTimeframes {
  primary: string;
  secondary: string;
  limit: number;
}

const MODALITY_TIMEFRAMES: Record<TradingModality, ModalityTimeframes> = {
  Scalping: { primary: '1m', secondary: '5m', limit: 60 },
  DayTrading: { primary: '15m', secondary: '1h', limit: 60 },
  SwingTrading: { primary: '4h', secondary: '1d', limit: 60 },
  TrendFollowing: { primary: '1d', secondary: '1w', limit: 52 },
};

// ─── RSI Calculation ──────────────────────────────────────────────────────────

function calculateRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return [];

  const rsiValues: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(100 - 100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsVal = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rsVal));
  }

  return rsiValues;
}

// ─── EMA Calculation ──────────────────────────────────────────────────────────

function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];

  const multiplier = 2 / (period + 1);
  const emaValues: number[] = [];

  const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaValues.push(seed);

  for (let i = period; i < closes.length; i++) {
    const ema = (closes[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
    emaValues.push(ema);
  }

  return emaValues;
}

// ─── RSI Divergence Detection ─────────────────────────────────────────────────

interface RSIDivergenceInternal {
  divergenceType: 'bearish' | 'bullish';
  priceHigh?: number;
  priceLow?: number;
  rsiHigh?: number;
  rsiLow?: number;
  currentPrice: number;
  currentRSI: number;
}

function detectRSIDivergenceInternal(klines: BinanceKline[]): RSIDivergenceInternal | null {
  if (klines.length < 30) return null;

  const closes = klines.map((k) => k.close);
  const rsiValues = calculateRSI(closes);

  if (rsiValues.length < 10) return null;

  const recentKlines = klines.slice(-20);
  const recentRSI = rsiValues.slice(-20);

  const priceHighIdx = recentKlines.reduce((maxIdx, k, i) => (k.high > recentKlines[maxIdx].high ? i : maxIdx), 0);
  const priceLowIdx = recentKlines.reduce((minIdx, k, i) => (k.low < recentKlines[minIdx].low ? i : minIdx), 0);

  const rsiHighIdx = recentRSI.reduce((maxIdx, v, i) => (v > recentRSI[maxIdx] ? i : maxIdx), 0);
  const rsiLowIdx = recentRSI.reduce((minIdx, v, i) => (v < recentRSI[minIdx] ? i : minIdx), 0);

  const lastPrice = closes[closes.length - 1];
  const lastRSI = rsiValues[rsiValues.length - 1];

  // Bearish divergence: price makes higher high, RSI makes lower high
  if (priceHighIdx > recentKlines.length / 2 && rsiHighIdx < recentRSI.length / 2) {
    if (recentKlines[priceHighIdx].high > recentKlines[0].high && recentRSI[rsiHighIdx] < recentRSI[0]) {
      return {
        divergenceType: 'bearish',
        priceHigh: recentKlines[priceHighIdx].high,
        rsiHigh: recentRSI[rsiHighIdx],
        currentPrice: lastPrice,
        currentRSI: lastRSI,
      };
    }
  }

  // Bullish divergence: price makes lower low, RSI makes higher low
  if (priceLowIdx > recentKlines.length / 2 && rsiLowIdx < recentRSI.length / 2) {
    if (recentKlines[priceLowIdx].low < recentKlines[0].low && recentRSI[rsiLowIdx] > recentRSI[0]) {
      return {
        divergenceType: 'bullish',
        priceLow: recentKlines[priceLowIdx].low,
        rsiLow: recentRSI[rsiLowIdx],
        currentPrice: lastPrice,
        currentRSI: lastRSI,
      };
    }
  }

  return null;
}

function toRSIDivergence(internal: RSIDivergenceInternal | null): RSIDivergence {
  if (!internal) return { detected: false, strength: 0, description: '' };
  const strength = internal.divergenceType === 'bearish' ? 70 : 65;
  return {
    detected: true,
    strength,
    description: `${internal.divergenceType} RSI divergence at price ${internal.currentPrice.toFixed(4)}, RSI ${internal.currentRSI.toFixed(1)}`,
  };
}

// ─── EMA Crossover Detection ──────────────────────────────────────────────────

interface EMACrossoverInternal {
  crossType: 'golden_cross' | 'death_cross';
  fastEMAValue: number;
  slowEMAValue: number;
  crossoverPriceValue: number;
}

function detectEMACrossoverInternal(klines: BinanceKline[]): EMACrossoverInternal | null {
  if (klines.length < 30) return null;

  const closes = klines.map((k) => k.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  if (ema9.length < 2 || ema21.length < 2) return null;

  const currentEMA9 = ema9[ema9.length - 1];
  const currentEMA21 = ema21[ema21.length - 1];
  const prevEMA9 = ema9[ema9.length - 2];
  const prevEMA21 = ema21[ema21.length - 2];

  const currentPrice = closes[closes.length - 1];

  if (prevEMA9 <= prevEMA21 && currentEMA9 > currentEMA21) {
    return {
      crossType: 'golden_cross',
      fastEMAValue: currentEMA9,
      slowEMAValue: currentEMA21,
      crossoverPriceValue: currentPrice,
    };
  }

  if (prevEMA9 >= prevEMA21 && currentEMA9 < currentEMA21) {
    return {
      crossType: 'death_cross',
      fastEMAValue: currentEMA9,
      slowEMAValue: currentEMA21,
      crossoverPriceValue: currentPrice,
    };
  }

  return null;
}

function toEMACrossover(internal: EMACrossoverInternal | null): EMACrossover {
  if (!internal) return { detected: false, strength: 0, description: '' };
  return {
    detected: true,
    strength: 75,
    description: `${internal.crossType.replace('_', ' ')} at ${internal.crossoverPriceValue.toFixed(4)} (EMA9: ${internal.fastEMAValue.toFixed(4)}, EMA21: ${internal.slowEMAValue.toFixed(4)})`,
  };
}

// ─── Candlestick Pattern Detection ───────────────────────────────────────────

interface CandlestickPatternInternal {
  patternType: string;
  patternDirection: 'bullish' | 'bearish' | 'neutral';
  patternStrength: number;
}

function detectCandlestickPatternInternal(klines: BinanceKline[]): CandlestickPatternInternal | null {
  if (klines.length < 3) return null;

  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2];
  const prev2 = klines[klines.length - 3];

  const lastBody = Math.abs(last.close - last.open);
  const lastRange = last.high - last.low;
  const prevBody = Math.abs(prev.close - prev.open);

  // Doji
  if (lastBody < lastRange * 0.1) {
    return { patternType: 'doji', patternDirection: 'neutral', patternStrength: 60 };
  }

  // Hammer (bullish reversal)
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  if (lowerWick > lastBody * 2 && upperWick < lastBody * 0.5 && last.close > last.open) {
    return { patternType: 'hammer', patternDirection: 'bullish', patternStrength: 70 };
  }

  // Shooting star (bearish reversal)
  if (upperWick > lastBody * 2 && lowerWick < lastBody * 0.5 && last.close < last.open) {
    return { patternType: 'shooting_star', patternDirection: 'bearish', patternStrength: 70 };
  }

  // Bullish engulfing
  if (
    prev.close < prev.open &&
    last.close > last.open &&
    last.open < prev.close &&
    last.close > prev.open
  ) {
    return { patternType: 'engulfing', patternDirection: 'bullish', patternStrength: 80 };
  }

  // Bearish engulfing
  if (
    prev.close > prev.open &&
    last.close < last.open &&
    last.open > prev.close &&
    last.close < prev.open
  ) {
    return { patternType: 'engulfing', patternDirection: 'bearish', patternStrength: 80 };
  }

  // Evening star (bearish)
  if (
    prev2.close > prev2.open &&
    Math.abs(prev.close - prev.open) < prevBody * 0.3 &&
    last.close < last.open &&
    last.close < (prev2.open + prev2.close) / 2
  ) {
    return { patternType: 'evening_star', patternDirection: 'bearish', patternStrength: 85 };
  }

  // Morning star (bullish)
  if (
    prev2.close < prev2.open &&
    Math.abs(prev.close - prev.open) < prevBody * 0.3 &&
    last.close > last.open &&
    last.close > (prev2.open + prev2.close) / 2
  ) {
    return { patternType: 'morning_star', patternDirection: 'bullish', patternStrength: 85 };
  }

  return null;
}

function toCandlestickPattern(internal: CandlestickPatternInternal | null): CandlestickPattern {
  if (!internal) return { detected: false, patternName: '', strength: 0 };
  return {
    detected: true,
    patternName: internal.patternType,
    strength: internal.patternStrength,
  };
}

// ─── Volatility Spike Detection ───────────────────────────────────────────────

interface VolatilitySpikeInternal {
  currentATRValue: number;
  baselineATRValue: number;
  spikeRatioValue: number;
  isSignificantSpike: boolean;
}

function detectVolatilitySpikeInternal(klines: BinanceKline[]): VolatilitySpikeInternal | null {
  if (klines.length < 20) return null;

  const closes = klines.map((k) => k.close);
  const currentATRValue = calculateATR(closes.slice(-15));
  const baselineATRValue = calculateATR(closes.slice(-30, -15));

  if (baselineATRValue === 0) return null;

  const spikeRatioValue = currentATRValue / baselineATRValue;

  if (spikeRatioValue > 1.5) {
    return {
      currentATRValue,
      baselineATRValue,
      spikeRatioValue,
      isSignificantSpike: spikeRatioValue > 2,
    };
  }

  return null;
}

function toVolatilitySpike(internal: VolatilitySpikeInternal | null): VolatilitySpike {
  if (!internal) return { detected: false, multiplier: 1, strength: 0 };
  return {
    detected: true,
    multiplier: internal.spikeRatioValue,
    strength: Math.min(100, Math.round(internal.spikeRatioValue * 30)),
  };
}

// ─── Support/Resistance Violation Detection ───────────────────────────────────

interface SRViolationInternal {
  violationType: 'support_break' | 'resistance_break';
  levelPrice: number;
  currentPriceValue: number;
  breakStrengthValue: number;
}

function detectSRViolationInternal(
  klines: BinanceKline[],
  entryPrice: number,
  positionType: 'Long' | 'Short'
): SRViolationInternal | null {
  const closes = klines.map((k) => k.close);
  const { support, resistance } = findSupportResistance(closes, entryPrice);

  const currentPrice = closes[closes.length - 1];

  if (positionType === 'Long' && support.length > 0) {
    const nearestSupport = support[0];
    if (currentPrice < nearestSupport) {
      return {
        violationType: 'support_break',
        levelPrice: nearestSupport,
        currentPriceValue: currentPrice,
        breakStrengthValue: ((nearestSupport - currentPrice) / nearestSupport) * 100,
      };
    }
  }

  if (positionType === 'Short' && resistance.length > 0) {
    const nearestResistance = resistance[0];
    if (currentPrice > nearestResistance) {
      return {
        violationType: 'resistance_break',
        levelPrice: nearestResistance,
        currentPriceValue: currentPrice,
        breakStrengthValue: ((currentPrice - nearestResistance) / nearestResistance) * 100,
      };
    }
  }

  return null;
}

function toSRViolation(internal: SRViolationInternal | null): SupportResistanceViolation {
  if (!internal) return { detected: false, level: 0, strength: 0 };
  return {
    detected: true,
    level: internal.levelPrice,
    strength: Math.min(100, Math.round(internal.breakStrengthValue * 10)),
  };
}

// ─── SMC: Breaker Block Detection ────────────────────────────────────────────

interface BreakerBlockSignal {
  detected: boolean;
  price: number;
  direction: 'bullish' | 'bearish';
  description: string;
}

function detectBreakerBlock(
  klines: BinanceKline[],
  positionType: 'Long' | 'Short'
): BreakerBlockSignal {
  const swings = detectSwingPoints(klines, 3);
  const bosSignals = detectBOS(klines, swings);
  const obs = detectOrderBlocks(klines, bosSignals);

  const currentPrice = klines[klines.length - 1].close;

  // A Breaker Block is a fully mitigated OB that has been broken through
  if (positionType === 'Long') {
    const mitigatedBullishOBs = obs.filter((ob) => ob.direction === 'bullish' && ob.mitigated);
    for (const ob of mitigatedBullishOBs.reverse()) {
      if (currentPrice < ob.low) {
        return {
          detected: true,
          price: ob.low,
          direction: 'bearish',
          description: `Breaker Block at ${ob.low.toFixed(4)} — bullish OB fully mitigated and broken through. Institutional order flipped bearish.`,
        };
      }
    }
  } else {
    const mitigatedBearishOBs = obs.filter((ob) => ob.direction === 'bearish' && ob.mitigated);
    for (const ob of mitigatedBearishOBs.reverse()) {
      if (currentPrice > ob.high) {
        return {
          detected: true,
          price: ob.high,
          direction: 'bullish',
          description: `Breaker Block at ${ob.high.toFixed(4)} — bearish OB fully mitigated and broken through. Institutional order flipped bullish.`,
        };
      }
    }
  }

  return { detected: false, price: currentPrice, direction: 'bullish', description: '' };
}

// ─── SMC: Liquidity Sweep Without BOS Continuation ───────────────────────────

interface LiquiditySweepSignal {
  detected: boolean;
  price: number;
  description: string;
}

function detectLiquiditySweepWithoutBOS(
  klines: BinanceKline[],
  positionType: 'Long' | 'Short'
): LiquiditySweepSignal {
  const swings = detectSwingPoints(klines, 3);
  const bosSignals = detectBOS(klines, swings);
  const recent = klines.slice(-10);
  const currentPrice = klines[klines.length - 1].close;

  if (positionType === 'Long') {
    const recentHighs = swings.filter((s) => s.type === 'high').slice(-3);
    for (const swing of recentHighs.reverse()) {
      const sweepCandle = recent.find((k) => k.high > swing.price && k.close < swing.price);
      if (sweepCandle) {
        const bosAfterSweep = bosSignals.find(
          (b) => b.index > swing.index && b.direction === 'bullish' && b.price > swing.price
        );
        if (!bosAfterSweep) {
          return {
            detected: true,
            price: sweepCandle.high,
            description: `Liquidity sweep above swing high at ${swing.price.toFixed(4)} without BOS continuation — bearish manipulation, tighten SL.`,
          };
        }
      }
    }
  } else {
    const recentLows = swings.filter((s) => s.type === 'low').slice(-3);
    for (const swing of recentLows.reverse()) {
      const sweepCandle = recent.find((k) => k.low < swing.price && k.close > swing.price);
      if (sweepCandle) {
        const bosAfterSweep = bosSignals.find(
          (b) => b.index > swing.index && b.direction === 'bearish' && b.price < swing.price
        );
        if (!bosAfterSweep) {
          return {
            detected: true,
            price: sweepCandle.low,
            description: `Liquidity sweep below swing low at ${swing.price.toFixed(4)} without BOS continuation — bullish manipulation, tighten SL.`,
          };
        }
      }
    }
  }

  return { detected: false, price: currentPrice, description: '' };
}

// ─── Main Reversal Detection ──────────────────────────────────────────────────

export async function detectMarketReversal(
  symbol: string,
  entryPrice: number,
  positionType: 'Long' | 'Short',
  modality: TradingModality
): Promise<ReversalSignal> {
  const timeframes = MODALITY_TIMEFRAMES[modality];

  let klines: BinanceKline[] = [];
  try {
    klines = await fetchKlines(symbol, timeframes.primary, timeframes.limit);
  } catch {
    return {
      detectedReversal: false,
      confidence: 0,
      reason: 'Unable to fetch market data for reversal analysis',
      recommendedAction: 'none',
      suggestedNewSL: entryPrice,
    };
  }

  if (klines.length < 20) {
    return {
      detectedReversal: false,
      confidence: 0,
      reason: 'Insufficient data for reversal analysis',
      recommendedAction: 'none',
      suggestedNewSL: entryPrice,
    };
  }

  const closes = klines.map((k) => k.close);
  const currentPrice = closes[closes.length - 1];
  const atr = calcATRFromKlines(klines);

  // ─── Classic signals (internal representations) ────────────────────────────
  const rsiDivInternal = detectRSIDivergenceInternal(klines);
  const emaCrossInternal = detectEMACrossoverInternal(klines);
  const candleInternal = detectCandlestickPatternInternal(klines);
  const volSpikeInternal = detectVolatilitySpikeInternal(klines);
  const srViolInternal = detectSRViolationInternal(klines, entryPrice, positionType);

  // Convert to exported types (for any consumers that use them)
  const _rsiDivergence: RSIDivergence = toRSIDivergence(rsiDivInternal);
  const _emaCrossover: EMACrossover = toEMACrossover(emaCrossInternal);
  const _candlestickPattern: CandlestickPattern = toCandlestickPattern(candleInternal);
  const _volatilitySpike: VolatilitySpike = toVolatilitySpike(volSpikeInternal);
  const _srViolation: SupportResistanceViolation = toSRViolation(srViolInternal);

  // Suppress unused variable warnings
  void _rsiDivergence;
  void _emaCrossover;
  void _candlestickPattern;
  void _volatilitySpike;
  void _srViolation;

  // ─── SMC signals ──────────────────────────────────────────────────────────
  const swings = detectSwingPoints(klines, 3);
  const bosSignals = detectBOS(klines, swings);
  const chochSignals = detectCHOCH(klines, swings);
  const fvgs = detectFVGs(klines);

  const breakerBlock = detectBreakerBlock(klines, positionType);
  const liquiditySweep = detectLiquiditySweepWithoutBOS(klines, positionType);

  // Opposing FVG detection
  const opposingFVGDir = positionType === 'Long' ? 'bearish' : 'bullish';
  const opposingFVG = findNearestOpenFVG(fvgs, currentPrice, opposingFVGDir);
  const opposingFVGNearby = opposingFVG
    ? Math.abs(opposingFVG.midpoint - currentPrice) / currentPrice < 0.02
    : false;

  // CHOCH in reversal direction
  const reversalCHOCH = chochSignals.find((c) => {
    if (positionType === 'Long') return c.direction === 'bearish';
    return c.direction === 'bullish';
  });

  // ─── Signal counting & confidence scoring ─────────────────────────────────
  let signalCount = 0;
  const signalDescriptions: string[] = [];

  // Classic signals
  const isReversalRSI =
    (positionType === 'Long' && rsiDivInternal?.divergenceType === 'bearish') ||
    (positionType === 'Short' && rsiDivInternal?.divergenceType === 'bullish');
  if (isReversalRSI && rsiDivInternal) {
    signalCount++;
    signalDescriptions.push(`RSI ${rsiDivInternal.divergenceType} divergence`);
  }

  const isReversalEMA =
    (positionType === 'Long' && emaCrossInternal?.crossType === 'death_cross') ||
    (positionType === 'Short' && emaCrossInternal?.crossType === 'golden_cross');
  if (isReversalEMA && emaCrossInternal) {
    signalCount++;
    signalDescriptions.push(`EMA ${emaCrossInternal.crossType.replace('_', ' ')} at ${emaCrossInternal.crossoverPriceValue.toFixed(4)}`);
  }

  const isReversalCandle =
    (positionType === 'Long' && candleInternal?.patternDirection === 'bearish') ||
    (positionType === 'Short' && candleInternal?.patternDirection === 'bullish');
  if (isReversalCandle && candleInternal) {
    signalCount++;
    signalDescriptions.push(`${candleInternal.patternType} candlestick pattern`);
  }

  if (volSpikeInternal?.isSignificantSpike) {
    signalCount++;
    signalDescriptions.push(`ATR volatility spike (${volSpikeInternal.spikeRatioValue.toFixed(1)}x baseline)`);
  }

  if (srViolInternal) {
    signalCount++;
    signalDescriptions.push(`${srViolInternal.violationType.replace('_', ' ')} at ${srViolInternal.levelPrice.toFixed(4)}`);
  }

  // SMC signals
  if (reversalCHOCH) {
    signalCount++;
    signalDescriptions.push(`CHOCH on ${timeframes.primary} at ${reversalCHOCH.price.toFixed(4)}`);
  }

  if (breakerBlock.detected) {
    signalCount++;
    signalDescriptions.push(`Breaker Block at ${breakerBlock.price.toFixed(4)}`);
  }

  if (liquiditySweep.detected) {
    signalCount++;
    signalDescriptions.push(`Liquidity sweep without BOS at ${liquiditySweep.price.toFixed(4)}`);
  }

  if (opposingFVGNearby && opposingFVG) {
    signalCount++;
    signalDescriptions.push(`Opposing ${opposingFVGDir} FVG at ${opposingFVG.midpoint.toFixed(4)}`);
  }

  // ─── Confidence scoring (SMC-aligned) ─────────────────────────────────────
  // 2 signals = 60, 3 signals = 80, 4+ signals = 95
  let confidence = 0;
  if (signalCount >= 4) confidence = 95;
  else if (signalCount === 3) confidence = 80;
  else if (signalCount === 2) confidence = 60;
  else if (signalCount === 1) confidence = 40;

  const detectedReversal = signalCount >= 2;

  // ─── Recommended action ───────────────────────────────────────────────────
  let recommendedAction: ReversalSignal['recommendedAction'] = 'none';

  if (reversalCHOCH && breakerBlock.detected) {
    recommendedAction = 'reverse';
  } else if (reversalCHOCH && !breakerBlock.detected) {
    recommendedAction = 'tighten_sl';
  } else if (liquiditySweep.detected) {
    recommendedAction = 'tighten_sl';
  } else if (signalCount >= 3) {
    recommendedAction = 'close';
  } else if (signalCount >= 2) {
    recommendedAction = 'tighten_sl';
  } else if (opposingFVGNearby) {
    recommendedAction = 'none';
  }

  // ─── Suggested new SL ─────────────────────────────────────────────────────
  let suggestedNewSL = entryPrice;
  if (recommendedAction === 'tighten_sl' || recommendedAction === 'close') {
    const tightenBuffer = atr * 0.5;
    suggestedNewSL = positionType === 'Long'
      ? currentPrice - tightenBuffer
      : currentPrice + tightenBuffer;
  }

  // Build reason string with SMC references first
  const smcParts: string[] = [];
  if (reversalCHOCH) smcParts.push(`CHOCH on ${timeframes.primary} at ${reversalCHOCH.price.toFixed(4)}`);
  if (breakerBlock.detected) smcParts.push(`Breaker Block at ${breakerBlock.price.toFixed(4)}`);
  if (liquiditySweep.detected) smcParts.push(liquiditySweep.description);
  if (opposingFVGNearby && opposingFVG) smcParts.push(`Opposing FVG at ${opposingFVG.midpoint.toFixed(4)}`);

  const classicParts = signalDescriptions.filter(
    (d) => !d.includes('CHOCH') && !d.includes('Breaker') && !d.includes('sweep') && !d.includes('FVG')
  );

  const allParts = [...smcParts, ...classicParts];
  const reason = allParts.length > 0
    ? allParts.join(' + ')
    : 'No significant reversal signals detected';

  return {
    detectedReversal,
    confidence,
    reason,
    recommendedAction,
    suggestedNewSL,
  };
}

// ─── Legacy alias used by useAITradeMonitoring ────────────────────────────────

interface DetectReversalParams {
  symbol: string;
  positionType: 'Long' | 'Short';
  entryPrice: number;
  effectiveSL: number;
  currentPrice: number;
  modality: TradingModality;
  tp1Executed: boolean;
  tp2Executed: boolean;
  tp3Executed: boolean;
  tp1: number;
}

export async function detectReversal(params: DetectReversalParams): Promise<ReversalSignal> {
  return detectMarketReversal(
    params.symbol,
    params.entryPrice,
    params.positionType,
    params.modality
  );
}
