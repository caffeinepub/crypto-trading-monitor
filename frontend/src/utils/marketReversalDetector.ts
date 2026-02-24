/**
 * Market Reversal Detection Algorithm
 *
 * Analyzes Binance kline data to identify trend reversals using:
 * 1. RSI divergence detection
 * 2. EMA crossover signals
 * 3. Candlestick pattern recognition
 * 4. ATR-based volatility spike detection
 * 5. Support/resistance zone violations
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

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(100 - 100 / (1 + rs));

  // Subsequent values using Wilder's smoothing
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

  // Seed with SMA
  const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emaValues.push(seed);

  for (let i = period; i < closes.length; i++) {
    const ema = (closes[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
    emaValues.push(ema);
  }

  return emaValues;
}

// ─── RSI Divergence Detection ─────────────────────────────────────────────────

function detectRSIDivergence(
  closes: number[],
  positionType: 'Long' | 'Short'
): RSIDivergence {
  const rsi = calculateRSI(closes, 14);
  if (rsi.length < 10) {
    return { detected: false, strength: 0, description: 'Insufficient data for RSI divergence' };
  }

  const recentCloses = closes.slice(-10);
  const recentRSI = rsi.slice(-10);

  // Price trend (last 10 candles)
  const priceSlope = recentCloses[recentCloses.length - 1] - recentCloses[0];
  // RSI trend (last 10 values)
  const rsiSlope = recentRSI[recentRSI.length - 1] - recentRSI[0];

  const lastRSI = recentRSI[recentRSI.length - 1];

  // Bearish divergence: price making higher highs but RSI making lower highs → reversal for Long
  // Bullish divergence: price making lower lows but RSI making higher lows → reversal for Short
  let detected = false;
  let strength = 0;
  let description = '';

  if (positionType === 'Long') {
    // Look for bearish divergence (price up, RSI down) with RSI in overbought territory
    if (priceSlope > 0 && rsiSlope < -3 && lastRSI > 60) {
      detected = true;
      strength = Math.min(100, Math.abs(rsiSlope) * 3 + (lastRSI - 60));
      description = `Bearish RSI divergence: price rising but RSI falling (RSI: ${lastRSI.toFixed(1)})`;
    }
  } else {
    // Look for bullish divergence (price down, RSI up) with RSI in oversold territory
    if (priceSlope < 0 && rsiSlope > 3 && lastRSI < 40) {
      detected = true;
      strength = Math.min(100, Math.abs(rsiSlope) * 3 + (40 - lastRSI));
      description = `Bullish RSI divergence: price falling but RSI rising (RSI: ${lastRSI.toFixed(1)})`;
    }
  }

  return { detected, strength, description };
}

// ─── EMA Crossover Detection ──────────────────────────────────────────────────

function detectEMACrossover(
  closes: number[],
  positionType: 'Long' | 'Short'
): EMACrossover {
  if (closes.length < 55) {
    return { detected: false, strength: 0, description: 'Insufficient data for EMA crossover' };
  }

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);

  if (ema9.length < 3 || ema21.length < 3 || ema50.length < 3) {
    return { detected: false, strength: 0, description: 'Insufficient EMA data' };
  }

  const lastEma9 = ema9[ema9.length - 1];
  const prevEma9 = ema9[ema9.length - 2];
  const lastEma21 = ema21[ema21.length - 1];
  const prevEma21 = ema21[ema21.length - 2];
  const lastEma50 = ema50[ema50.length - 1];

  let detected = false;
  let strength = 0;
  let description = '';

  if (positionType === 'Long') {
    // Bearish crossover: EMA9 crosses below EMA21 (death cross signal)
    const shortTermCross = prevEma9 >= prevEma21 && lastEma9 < lastEma21;
    // Price below EMA50 (trend weakening)
    const belowLongTerm = closes[closes.length - 1] < lastEma50;

    if (shortTermCross) {
      detected = true;
      strength = 60;
      description = 'EMA9 crossed below EMA21 — bearish momentum shift';
      if (belowLongTerm) {
        strength = 80;
        description += ' with price below EMA50';
      }
    } else if (belowLongTerm && lastEma9 < lastEma21) {
      detected = true;
      strength = 40;
      description = 'Price below EMA50 with bearish EMA alignment';
    }
  } else {
    // Bullish crossover: EMA9 crosses above EMA21
    const shortTermCross = prevEma9 <= prevEma21 && lastEma9 > lastEma21;
    // Price above EMA50 (trend strengthening against short)
    const aboveLongTerm = closes[closes.length - 1] > lastEma50;

    if (shortTermCross) {
      detected = true;
      strength = 60;
      description = 'EMA9 crossed above EMA21 — bullish momentum shift';
      if (aboveLongTerm) {
        strength = 80;
        description += ' with price above EMA50';
      }
    } else if (aboveLongTerm && lastEma9 > lastEma21) {
      detected = true;
      strength = 40;
      description = 'Price above EMA50 with bullish EMA alignment';
    }
  }

  return { detected, strength, description };
}

// ─── Candlestick Pattern Recognition ─────────────────────────────────────────

function detectCandlestickPattern(
  klines: BinanceKline[],
  positionType: 'Long' | 'Short'
): CandlestickPattern {
  if (klines.length < 3) {
    return { detected: false, patternName: '', strength: 0 };
  }

  const last = klines[klines.length - 1];
  const prev = klines[klines.length - 2];
  const prev2 = klines[klines.length - 3];

  const lastBody = Math.abs(last.close - last.open);
  const lastRange = last.high - last.low;
  const prevBody = Math.abs(prev.close - prev.open);

  if (lastRange === 0) return { detected: false, patternName: '', strength: 0 };

  const bodyRatio = lastBody / lastRange;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  if (positionType === 'Long') {
    // Bearish Engulfing: current bearish candle engulfs previous bullish candle
    if (
      last.close < last.open && // current is bearish
      prev.close > prev.open && // previous is bullish
      last.open >= prev.close && // current opens at or above prev close
      last.close <= prev.open // current closes at or below prev open
    ) {
      return {
        detected: true,
        patternName: 'Bearish Engulfing',
        strength: Math.min(100, 60 + (lastBody / prevBody) * 20),
      };
    }

    // Shooting Star: small body at bottom, long upper wick
    if (
      upperWick > lastBody * 2 &&
      lowerWick < lastBody * 0.5 &&
      bodyRatio < 0.3 &&
      last.close < prev.close // closing lower than previous
    ) {
      return {
        detected: true,
        patternName: 'Shooting Star',
        strength: Math.min(100, 50 + (upperWick / lastRange) * 50),
      };
    }

    // Evening Star (3-candle): bullish, doji/small, bearish
    if (
      prev2.close > prev2.open && // first candle bullish
      Math.abs(prev.close - prev.open) < prevBody * 0.3 && // middle is small/doji
      last.close < last.open && // last is bearish
      last.close < (prev2.open + prev2.close) / 2 // closes below midpoint of first
    ) {
      return { detected: true, patternName: 'Evening Star', strength: 75 };
    }
  } else {
    // Bullish Engulfing: current bullish candle engulfs previous bearish candle
    if (
      last.close > last.open && // current is bullish
      prev.close < prev.open && // previous is bearish
      last.open <= prev.close && // current opens at or below prev close
      last.close >= prev.open // current closes at or above prev open
    ) {
      return {
        detected: true,
        patternName: 'Bullish Engulfing',
        strength: Math.min(100, 60 + (lastBody / prevBody) * 20),
      };
    }

    // Hammer: small body at top, long lower wick
    if (
      lowerWick > lastBody * 2 &&
      upperWick < lastBody * 0.5 &&
      bodyRatio < 0.3 &&
      last.close > prev.close // closing higher than previous
    ) {
      return {
        detected: true,
        patternName: 'Hammer',
        strength: Math.min(100, 50 + (lowerWick / lastRange) * 50),
      };
    }

    // Morning Star (3-candle): bearish, doji/small, bullish
    if (
      prev2.close < prev2.open && // first candle bearish
      Math.abs(prev.close - prev.open) < prevBody * 0.3 && // middle is small/doji
      last.close > last.open && // last is bullish
      last.close > (prev2.open + prev2.close) / 2 // closes above midpoint of first
    ) {
      return { detected: true, patternName: 'Morning Star', strength: 75 };
    }
  }

  return { detected: false, patternName: '', strength: 0 };
}

// ─── ATR Volatility Spike Detection ──────────────────────────────────────────

function detectVolatilitySpike(closes: number[]): VolatilitySpike {
  if (closes.length < 20) {
    return { detected: false, multiplier: 1, strength: 0 };
  }

  const recentATR = calculateATR(closes.slice(-15), 14);
  const baselineATR = calculateATR(closes.slice(-30, -15), 14);

  if (baselineATR === 0) {
    return { detected: false, multiplier: 1, strength: 0 };
  }

  const multiplier = recentATR / baselineATR;

  if (multiplier > 1.8) {
    const strength = Math.min(100, (multiplier - 1.8) * 50 + 40);
    return {
      detected: true,
      multiplier,
      strength,
    };
  }

  return { detected: false, multiplier, strength: 0 };
}

// ─── Support/Resistance Violation Detection ───────────────────────────────────

function detectSRViolation(
  closes: number[],
  currentPrice: number,
  positionType: 'Long' | 'Short'
): SupportResistanceViolation {
  if (closes.length < 20) {
    return { detected: false, level: 0, strength: 0 };
  }

  const { support, resistance } = findSupportResistance(closes, currentPrice);

  if (positionType === 'Long') {
    // For Long: check if price broke below a key support level
    const nearestSupport = support[0];
    if (nearestSupport && currentPrice < nearestSupport) {
      const violation = (nearestSupport - currentPrice) / nearestSupport;
      const strength = Math.min(100, violation * 2000);
      return { detected: strength > 20, level: nearestSupport, strength };
    }
  } else {
    // For Short: check if price broke above a key resistance level
    const nearestResistance = resistance[0];
    if (nearestResistance && currentPrice > nearestResistance) {
      const violation = (currentPrice - nearestResistance) / nearestResistance;
      const strength = Math.min(100, violation * 2000);
      return { detected: strength > 20, level: nearestResistance, strength };
    }
  }

  return { detected: false, level: 0, strength: 0 };
}

// ─── Main detectReversal Function ─────────────────────────────────────────────

export interface DetectReversalParams {
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
  const {
    symbol,
    positionType,
    entryPrice,
    effectiveSL,
    currentPrice,
    modality,
    tp1Executed,
    tp1,
  } = params;

  const timeframes = MODALITY_TIMEFRAMES[modality];

  try {
    // Fetch primary timeframe klines
    const klines = await fetchKlines(symbol, timeframes.primary, timeframes.limit);

    if (klines.length < 20) {
      return {
        detectedReversal: false,
        confidence: 0,
        reason: 'Insufficient kline data for reversal detection',
        recommendedAction: 'none',
      };
    }

    const closes = klines.map((k) => k.close);

    // Run all five detection mechanisms
    const rsiDivergence = detectRSIDivergence(closes, positionType);
    const emaCrossover = detectEMACrossover(closes, positionType);
    const candlestickPattern = detectCandlestickPattern(klines, positionType);
    const volatilitySpike = detectVolatilitySpike(closes);
    const srViolation = detectSRViolation(closes, currentPrice, positionType);

    // Weight each signal's contribution to confidence score
    // RSI divergence: weight 25%
    // EMA crossover: weight 30%
    // Candlestick pattern: weight 20%
    // Volatility spike: weight 10%
    // S/R violation: weight 15%
    const weightedScore =
      (rsiDivergence.detected ? rsiDivergence.strength * 0.25 : 0) +
      (emaCrossover.detected ? emaCrossover.strength * 0.30 : 0) +
      (candlestickPattern.detected ? candlestickPattern.strength * 0.20 : 0) +
      (volatilitySpike.detected ? volatilitySpike.strength * 0.10 : 0) +
      (srViolation.detected ? srViolation.strength * 0.15 : 0);

    const confidence = Math.min(100, Math.round(weightedScore));

    // Build reason string from detected signals
    const reasons: string[] = [];
    if (rsiDivergence.detected) reasons.push(rsiDivergence.description);
    if (emaCrossover.detected) reasons.push(emaCrossover.description);
    if (candlestickPattern.detected) reasons.push(`${candlestickPattern.patternName} pattern detected`);
    if (volatilitySpike.detected) reasons.push(`Volatility spike (${volatilitySpike.multiplier.toFixed(1)}x ATR)`);
    if (srViolation.detected) reasons.push(`S/R level violated at $${srViolation.level.toFixed(2)}`);

    const reason = reasons.length > 0
      ? reasons.join('; ')
      : 'No significant reversal signals detected';

    const detectedReversal = confidence >= 50;

    // Determine recommended action
    let recommendedAction: ReversalSignal['recommendedAction'] = 'none';
    let suggestedNewSL: number | undefined;

    if (confidence > 85 && tp1Executed) {
      // Strong reversal signal AND trade has accumulated profit past TP1 → reverse
      recommendedAction = 'reverse';
    } else if (confidence > 75) {
      // Strong reversal signal → close to protect profits
      recommendedAction = 'close';
    } else if (confidence >= 50) {
      // Moderate reversal signal → tighten stop-loss
      recommendedAction = 'tighten_sl';
      // Suggested new SL: halfway between current price and entry price
      if (positionType === 'Long') {
        // For Long: move SL up toward current price
        const midpoint = (currentPrice + entryPrice) / 2;
        // Only tighten if it's better than current effectiveSL
        suggestedNewSL = Math.max(effectiveSL, midpoint);
        // Don't suggest a SL that would immediately trigger
        if (suggestedNewSL >= currentPrice * 0.999) {
          suggestedNewSL = effectiveSL;
          recommendedAction = 'none';
        }
      } else {
        // For Short: move SL down toward current price
        const midpoint = (currentPrice + entryPrice) / 2;
        suggestedNewSL = Math.min(effectiveSL, midpoint);
        if (suggestedNewSL <= currentPrice * 1.001) {
          suggestedNewSL = effectiveSL;
          recommendedAction = 'none';
        }
      }
    }

    // Additional guard: don't suggest tighten_sl if TP1 hasn't been hit yet
    // and the suggested SL would be worse than entry (would lock in a loss)
    if (recommendedAction === 'tighten_sl' && !tp1Executed) {
      if (positionType === 'Long' && suggestedNewSL !== undefined && suggestedNewSL < entryPrice) {
        recommendedAction = 'none';
        suggestedNewSL = undefined;
      } else if (positionType === 'Short' && suggestedNewSL !== undefined && suggestedNewSL > entryPrice) {
        recommendedAction = 'none';
        suggestedNewSL = undefined;
      }
    }

    // Don't suggest reversal if TP1 price hasn't been reached
    if (recommendedAction === 'reverse') {
      const tp1Reached = positionType === 'Long' ? currentPrice >= tp1 : currentPrice <= tp1;
      if (!tp1Reached) {
        recommendedAction = 'close';
      }
    }

    return {
      detectedReversal,
      confidence,
      reason,
      recommendedAction,
      suggestedNewSL,
    };
  } catch (err) {
    console.error(`Reversal detection failed for ${symbol}:`, err);
    return {
      detectedReversal: false,
      confidence: 0,
      reason: 'Reversal detection unavailable',
      recommendedAction: 'none',
    };
  }
}
