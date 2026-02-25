/**
 * SMC (Smart Money Concepts) Analysis Library
 *
 * Shared utilities for detecting institutional market structure:
 * - BOS (Break of Structure)
 * - CHOCH (Change of Character)
 * - Order Blocks (OB)
 * - Fair Value Gaps (FVG)
 * - Liquidity Zones (Equal Highs/Lows, Swing Points)
 * - Wyckoff Phase Estimation
 * - Manipulation / Stop Hunt Detection
 */

import { BinanceKline } from '../services/binanceApi';

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
}

export interface OrderBlock {
  index: number;
  high: number;
  low: number;
  close: number;
  open: number;
  direction: 'bullish' | 'bearish'; // bullish OB = last bearish candle before bullish displacement
  mitigated: boolean;
  price: number; // midpoint
}

export interface FairValueGap {
  index: number;
  high: number;
  low: number;
  direction: 'bullish' | 'bearish';
  filled: boolean;
  midpoint: number;
}

export interface LiquidityZone {
  price: number;
  type: 'equal_highs' | 'equal_lows' | 'swing_high' | 'swing_low';
  strength: number; // 1-3 touches
}

export interface BOSSignal {
  index: number;
  price: number;
  direction: 'bullish' | 'bearish';
  displacement: number; // % displacement confirming BOS
}

export interface CHOCHSignal {
  index: number;
  price: number;
  direction: 'bullish' | 'bearish'; // direction of the new structure
  displacement: number;
}

export interface ManipulationSignal {
  detected: boolean;
  type: 'stop_hunt' | 'fakeout' | 'none';
  price: number;
  description: string;
}

export type WyckoffPhase = 'accumulation' | 'distribution' | 'markup' | 'markdown' | 'unknown';

// ─── Swing Point Detection ────────────────────────────────────────────────────

export function detectSwingPoints(klines: BinanceKline[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < klines.length - lookback; i++) {
    const highs = klines.slice(i - lookback, i + lookback + 1).map((k) => k.high);
    const lows = klines.slice(i - lookback, i + lookback + 1).map((k) => k.low);
    const isSwingHigh = klines[i].high === Math.max(...highs);
    const isSwingLow = klines[i].low === Math.min(...lows);
    if (isSwingHigh) swings.push({ index: i, price: klines[i].high, type: 'high' });
    if (isSwingLow) swings.push({ index: i, price: klines[i].low, type: 'low' });
  }
  return swings;
}

// ─── BOS Detection ────────────────────────────────────────────────────────────

export function detectBOS(klines: BinanceKline[], swings: SwingPoint[]): BOSSignal[] {
  const bosSignals: BOSSignal[] = [];
  const highs = swings.filter((s) => s.type === 'high').slice(-5);
  const lows = swings.filter((s) => s.type === 'low').slice(-5);

  // Bullish BOS: price breaks above a significant swing high with displacement
  for (const swing of highs) {
    const laterKlines = klines.slice(swing.index + 1);
    for (let i = 0; i < laterKlines.length; i++) {
      if (laterKlines[i].close > swing.price) {
        const displacement = ((laterKlines[i].close - swing.price) / swing.price) * 100;
        if (displacement > 0.1) {
          bosSignals.push({
            index: swing.index + 1 + i,
            price: swing.price,
            direction: 'bullish',
            displacement,
          });
          break;
        }
      }
    }
  }

  // Bearish BOS: price breaks below a significant swing low with displacement
  for (const swing of lows) {
    const laterKlines = klines.slice(swing.index + 1);
    for (let i = 0; i < laterKlines.length; i++) {
      if (laterKlines[i].close < swing.price) {
        const displacement = ((swing.price - laterKlines[i].close) / swing.price) * 100;
        if (displacement > 0.1) {
          bosSignals.push({
            index: swing.index + 1 + i,
            price: swing.price,
            direction: 'bearish',
            displacement,
          });
          break;
        }
      }
    }
  }

  return bosSignals.sort((a, b) => a.index - b.index);
}

// ─── CHOCH Detection ──────────────────────────────────────────────────────────

export function detectCHOCH(klines: BinanceKline[], swings: SwingPoint[]): CHOCHSignal[] {
  const chochSignals: CHOCHSignal[] = [];
  if (swings.length < 4) return chochSignals;

  // Detect structure: in a downtrend (LH+LL), a break of a recent swing high = CHOCH bullish
  // In an uptrend (HH+HL), a break of a recent swing low = CHOCH bearish
  const recentSwings = swings.slice(-8);
  const recentHighs = recentSwings.filter((s) => s.type === 'high');
  const recentLows = recentSwings.filter((s) => s.type === 'low');

  // Check for bullish CHOCH: lower highs pattern broken
  if (recentHighs.length >= 2) {
    const lastHigh = recentHighs[recentHighs.length - 1];
    const prevHigh = recentHighs[recentHighs.length - 2];
    if (lastHigh.price < prevHigh.price) {
      // Downtrend structure — check if current price breaks above lastHigh
      const laterKlines = klines.slice(lastHigh.index + 1);
      for (let i = 0; i < laterKlines.length; i++) {
        if (laterKlines[i].close > lastHigh.price) {
          const displacement = ((laterKlines[i].close - lastHigh.price) / lastHigh.price) * 100;
          if (displacement > 0.15) {
            chochSignals.push({
              index: lastHigh.index + 1 + i,
              price: lastHigh.price,
              direction: 'bullish',
              displacement,
            });
            break;
          }
        }
      }
    }
  }

  // Check for bearish CHOCH: higher lows pattern broken
  if (recentLows.length >= 2) {
    const lastLow = recentLows[recentLows.length - 1];
    const prevLow = recentLows[recentLows.length - 2];
    if (lastLow.price > prevLow.price) {
      // Uptrend structure — check if current price breaks below lastLow
      const laterKlines = klines.slice(lastLow.index + 1);
      for (let i = 0; i < laterKlines.length; i++) {
        if (laterKlines[i].close < lastLow.price) {
          const displacement = ((lastLow.price - laterKlines[i].close) / lastLow.price) * 100;
          if (displacement > 0.15) {
            chochSignals.push({
              index: lastLow.index + 1 + i,
              price: lastLow.price,
              direction: 'bearish',
              displacement,
            });
            break;
          }
        }
      }
    }
  }

  return chochSignals.sort((a, b) => a.index - b.index);
}

// ─── Order Block Detection ────────────────────────────────────────────────────

export function detectOrderBlocks(klines: BinanceKline[], bosSignals: BOSSignal[]): OrderBlock[] {
  const obs: OrderBlock[] = [];

  for (const bos of bosSignals) {
    // Look back from BOS for the last opposing candle
    const lookbackStart = Math.max(0, bos.index - 10);
    const segment = klines.slice(lookbackStart, bos.index);

    if (bos.direction === 'bullish') {
      // Last bearish candle before bullish BOS = bullish OB
      for (let i = segment.length - 1; i >= 0; i--) {
        const candle = segment[i];
        if (candle.close < candle.open) {
          // Bearish candle = bullish OB
          const mitigated = klines.slice(lookbackStart + i + 1, bos.index + 5).some(
            (k) => k.low <= candle.low
          );
          obs.push({
            index: lookbackStart + i,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            open: candle.open,
            direction: 'bullish',
            mitigated,
            price: (candle.high + candle.low) / 2,
          });
          break;
        }
      }
    } else {
      // Last bullish candle before bearish BOS = bearish OB
      for (let i = segment.length - 1; i >= 0; i--) {
        const candle = segment[i];
        if (candle.close > candle.open) {
          const mitigated = klines.slice(lookbackStart + i + 1, bos.index + 5).some(
            (k) => k.high >= candle.high
          );
          obs.push({
            index: lookbackStart + i,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            open: candle.open,
            direction: 'bearish',
            mitigated,
            price: (candle.high + candle.low) / 2,
          });
          break;
        }
      }
    }
  }

  return obs;
}

// ─── Fair Value Gap Detection ─────────────────────────────────────────────────

export function detectFVGs(klines: BinanceKline[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  for (let i = 1; i < klines.length - 1; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];
    const next = klines[i + 1];

    // Bullish FVG: gap between prev candle high and next candle low (price jumped up)
    if (next.low > prev.high) {
      const gapHigh = next.low;
      const gapLow = prev.high;
      const filled = klines.slice(i + 2).some((k) => k.low <= gapLow);
      fvgs.push({
        index: i,
        high: gapHigh,
        low: gapLow,
        direction: 'bullish',
        filled,
        midpoint: (gapHigh + gapLow) / 2,
      });
    }

    // Bearish FVG: gap between prev candle low and next candle high (price jumped down)
    if (next.high < prev.low) {
      const gapHigh = prev.low;
      const gapLow = next.high;
      const filled = klines.slice(i + 2).some((k) => k.high >= gapHigh);
      fvgs.push({
        index: i,
        high: gapHigh,
        low: gapLow,
        direction: 'bearish',
        filled,
        midpoint: (gapHigh + gapLow) / 2,
      });
    }

    void curr; // suppress unused warning
  }

  return fvgs;
}

// ─── Liquidity Zone Detection ─────────────────────────────────────────────────

export function detectLiquidityZones(klines: BinanceKline[], tolerance: number = 0.003): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);

  // Equal highs detection
  for (let i = 0; i < highs.length; i++) {
    let count = 0;
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[j] - highs[i]) / highs[i] < tolerance) count++;
    }
    if (count >= 1) {
      zones.push({ price: highs[i], type: 'equal_highs', strength: Math.min(3, count + 1) });
    }
  }

  // Equal lows detection
  for (let i = 0; i < lows.length; i++) {
    let count = 0;
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[j] - lows[i]) / lows[i] < tolerance) count++;
    }
    if (count >= 1) {
      zones.push({ price: lows[i], type: 'equal_lows', strength: Math.min(3, count + 1) });
    }
  }

  return zones;
}

// ─── Manipulation / Stop Hunt Detection ──────────────────────────────────────

export function detectManipulation(
  klines: BinanceKline[],
  swings: SwingPoint[],
  currentPrice: number
): ManipulationSignal {
  if (klines.length < 5) return { detected: false, type: 'none', price: currentPrice, description: 'Insufficient data' };

  const recent = klines.slice(-10);
  const recentHighs = swings.filter((s) => s.type === 'high').slice(-3);
  const recentLows = swings.filter((s) => s.type === 'low').slice(-3);

  // Stop hunt: wick pierces swing high/low but closes back inside
  for (const swing of recentHighs) {
    const afterSwing = recent.filter((_, i) => i > 0);
    for (const candle of afterSwing) {
      if (candle.high > swing.price && candle.close < swing.price) {
        const wickSize = ((candle.high - candle.close) / candle.close) * 100;
        if (wickSize > 0.3) {
          return {
            detected: true,
            type: 'stop_hunt',
            price: candle.high,
            description: `Stop hunt detected above swing high at ${swing.price.toFixed(4)} — wick of ${wickSize.toFixed(2)}% closed back below. Bearish manipulation resolved.`,
          };
        }
      }
    }
  }

  for (const swing of recentLows) {
    const afterSwing = recent.filter((_, i) => i > 0);
    for (const candle of afterSwing) {
      if (candle.low < swing.price && candle.close > swing.price) {
        const wickSize = ((candle.close - candle.low) / candle.close) * 100;
        if (wickSize > 0.3) {
          return {
            detected: true,
            type: 'stop_hunt',
            price: candle.low,
            description: `Stop hunt detected below swing low at ${swing.price.toFixed(4)} — wick of ${wickSize.toFixed(2)}% closed back above. Bullish manipulation resolved.`,
          };
        }
      }
    }
  }

  // Fakeout: BOS without displacement (weak close beyond level)
  const lastCandle = klines[klines.length - 1];
  const prevCandle = klines[klines.length - 2];
  if (recentHighs.length > 0) {
    const lastHigh = recentHighs[recentHighs.length - 1];
    if (lastCandle.high > lastHigh.price && lastCandle.close < lastHigh.price) {
      return {
        detected: true,
        type: 'fakeout',
        price: lastCandle.high,
        description: `Fakeout above ${lastHigh.price.toFixed(4)} — no displacement confirmation. Avoid Long entry until BOS confirmed with strong close.`,
      };
    }
  }
  if (recentLows.length > 0) {
    const lastLow = recentLows[recentLows.length - 1];
    if (lastCandle.low < lastLow.price && lastCandle.close > lastLow.price) {
      return {
        detected: true,
        type: 'fakeout',
        price: lastCandle.low,
        description: `Fakeout below ${lastLow.price.toFixed(4)} — no displacement confirmation. Avoid Short entry until BOS confirmed with strong close.`,
      };
    }
  }

  void prevCandle;
  return { detected: false, type: 'none', price: currentPrice, description: 'No manipulation detected' };
}

// ─── ATR from BinanceKline ────────────────────────────────────────────────────

export function calcATRFromKlines(klines: BinanceKline[], period: number = 14): number {
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

// ─── Wyckoff Phase Estimation ─────────────────────────────────────────────────

export function estimateWyckoffPhase(klines: BinanceKline[], volumes: number[]): WyckoffPhase {
  if (klines.length < 20 || volumes.length < 20) return 'unknown';

  const closes = klines.map((k) => k.close);
  const recent = closes.slice(-20);
  const recentVols = volumes.slice(-20);

  const firstHalfPrices = recent.slice(0, 10);
  const secondHalfPrices = recent.slice(10);
  const firstHalfVols = recentVols.slice(0, 10);
  const secondHalfVols = recentVols.slice(10);

  const firstAvgPrice = firstHalfPrices.reduce((a, b) => a + b, 0) / 10;
  const secondAvgPrice = secondHalfPrices.reduce((a, b) => a + b, 0) / 10;
  const firstAvgVol = firstHalfVols.reduce((a, b) => a + b, 0) / 10;
  const secondAvgVol = secondHalfVols.reduce((a, b) => a + b, 0) / 10;

  const priceChange = ((secondAvgPrice - firstAvgPrice) / firstAvgPrice) * 100;
  const volChange = ((secondAvgVol - firstAvgVol) / firstAvgVol) * 100;

  // Accumulation: price range-bound or slightly down, volume declining then spiking
  if (Math.abs(priceChange) < 3 && volChange > 20) return 'accumulation';
  // Distribution: price range-bound or slightly up, volume declining
  if (Math.abs(priceChange) < 3 && volChange < -10) return 'distribution';
  // Markup: price rising with volume
  if (priceChange > 3 && volChange > 0) return 'markup';
  // Markdown: price falling with volume
  if (priceChange < -3 && volChange > 0) return 'markdown';

  return 'unknown';
}

// ─── Institutional Cycle Classification ──────────────────────────────────────

export type InstitutionalCycle = 'accumulation' | 'manipulation' | 'distribution' | 'unknown';

export function classifyInstitutionalCycle(
  klines: BinanceKline[],
  bosSignals: BOSSignal[],
  manipulation: ManipulationSignal
): InstitutionalCycle {
  if (manipulation.detected) return 'manipulation';
  if (bosSignals.length === 0) return 'accumulation';

  const lastBOS = bosSignals[bosSignals.length - 1];
  const recentKlines = klines.slice(-5);
  const avgClose = recentKlines.reduce((a, k) => a + k.close, 0) / recentKlines.length;

  if (lastBOS.direction === 'bullish' && avgClose > lastBOS.price) return 'distribution';
  if (lastBOS.direction === 'bearish' && avgClose < lastBOS.price) return 'distribution';

  return 'accumulation';
}

// ─── Nearest Unmitigated OB ───────────────────────────────────────────────────

export function findNearestUnmitigatedOB(
  obs: OrderBlock[],
  currentPrice: number,
  direction: 'bullish' | 'bearish'
): OrderBlock | null {
  const unmitigated = obs.filter((ob) => !ob.mitigated && ob.direction === direction);
  if (unmitigated.length === 0) return null;

  if (direction === 'bullish') {
    // For Long: nearest bullish OB below current price
    const below = unmitigated.filter((ob) => ob.price < currentPrice);
    if (below.length === 0) return null;
    return below.reduce((closest, ob) =>
      Math.abs(ob.price - currentPrice) < Math.abs(closest.price - currentPrice) ? ob : closest
    );
  } else {
    // For Short: nearest bearish OB above current price
    const above = unmitigated.filter((ob) => ob.price > currentPrice);
    if (above.length === 0) return null;
    return above.reduce((closest, ob) =>
      Math.abs(ob.price - currentPrice) < Math.abs(closest.price - currentPrice) ? ob : closest
    );
  }
}

// ─── Nearest Open FVG ─────────────────────────────────────────────────────────

export function findNearestOpenFVG(
  fvgs: FairValueGap[],
  currentPrice: number,
  direction: 'bullish' | 'bearish'
): FairValueGap | null {
  const open = fvgs.filter((f) => !f.filled && f.direction === direction);
  if (open.length === 0) return null;

  if (direction === 'bullish') {
    // Bullish FVG above current price acts as magnet for Long
    const above = open.filter((f) => f.midpoint > currentPrice);
    if (above.length === 0) return null;
    return above.reduce((closest, f) =>
      Math.abs(f.midpoint - currentPrice) < Math.abs(closest.midpoint - currentPrice) ? f : closest
    );
  } else {
    // Bearish FVG below current price acts as magnet for Short
    const below = open.filter((f) => f.midpoint < currentPrice);
    if (below.length === 0) return null;
    return below.reduce((closest, f) =>
      Math.abs(f.midpoint - currentPrice) < Math.abs(closest.midpoint - currentPrice) ? f : closest
    );
  }
}

// ─── Swept Liquidity Zone for SL Placement ───────────────────────────────────

export function findSweptLiquidityZone(
  klines: BinanceKline[],
  swings: SwingPoint[],
  direction: 'Long' | 'Short',
  currentPrice: number,
  atr: number
): { price: number; type: string } {
  const recent = klines.slice(-20);

  if (direction === 'Long') {
    // For Long: find the most recent swing low that was swept (wick below) and recovered
    const recentLows = swings.filter((s) => s.type === 'low' && s.price < currentPrice).slice(-3);
    for (const swing of recentLows.reverse()) {
      const afterSwing = recent.filter((k) => k.low <= swing.price * 1.001);
      if (afterSwing.length > 0) {
        const swept = afterSwing.find((k) => k.close > swing.price);
        if (swept) {
          return { price: swing.price - atr * 0.5, type: 'swept swing low' };
        }
      }
    }
    // Fallback: equal lows cluster
    const equalLows = recent.map((k) => k.low).filter(
      (l) => Math.abs(l - Math.min(...recent.map((k) => k.low))) / Math.min(...recent.map((k) => k.low)) < 0.003
    );
    if (equalLows.length >= 2) {
      return { price: Math.min(...equalLows) - atr * 0.5, type: 'equal lows cluster' };
    }
    return { price: currentPrice - atr * 1.5, type: 'ATR-based liquidity zone' };
  } else {
    // For Short: find the most recent swing high that was swept and recovered
    const recentHighs = swings.filter((s) => s.type === 'high' && s.price > currentPrice).slice(-3);
    for (const swing of recentHighs.reverse()) {
      const afterSwing = recent.filter((k) => k.high >= swing.price * 0.999);
      if (afterSwing.length > 0) {
        const swept = afterSwing.find((k) => k.close < swing.price);
        if (swept) {
          return { price: swing.price + atr * 0.5, type: 'swept swing high' };
        }
      }
    }
    const equalHighs = recent.map((k) => k.high).filter(
      (h) => Math.abs(h - Math.max(...recent.map((k) => k.high))) / Math.max(...recent.map((k) => k.high)) < 0.003
    );
    if (equalHighs.length >= 2) {
      return { price: Math.max(...equalHighs) + atr * 0.5, type: 'equal highs cluster' };
    }
    return { price: currentPrice + atr * 1.5, type: 'ATR-based liquidity zone' };
  }
}
