import { SentimentAnalysis, SentimentFactor } from '../types/sentiment';
import { BinanceKline } from '../services/binanceApi';
import {
  detectSwingPoints,
  detectBOS,
  detectFVGs,
  detectLiquidityZones,
  estimateWyckoffPhase,
  calcATRFromKlines,
} from './smcAnalysis';

interface TechnicalIndicators {
  rsi: number;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  priceAction: 'uptrend' | 'downtrend' | 'sideways';
  momentum: number;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (prices.length < 26) return 'neutral';

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;

  const macdLine = [macd];
  for (let i = 1; i < 9 && prices.length - i >= 26; i++) {
    const prevEma12 = calculateEMA(prices.slice(0, -i), 12);
    const prevEma26 = calculateEMA(prices.slice(0, -i), 26);
    macdLine.unshift(prevEma12 - prevEma26);
  }

  const signal = calculateEMA(macdLine, 9);

  if (macd > signal && macd > 0) return 'bullish';
  if (macd < signal && macd < 0) return 'bearish';
  return 'neutral';
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

function analyzePriceAction(prices: number[]): 'uptrend' | 'downtrend' | 'sideways' {
  if (prices.length < 20) return 'sideways';

  const recentPrices = prices.slice(-20);
  const firstHalf = recentPrices.slice(0, 10);
  const secondHalf = recentPrices.slice(10);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 2) return 'uptrend';
  if (change < -2) return 'downtrend';
  return 'sideways';
}

function analyzeVolumeTrend(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (volumes.length < 10) return 'stable';

  const recent = volumes.slice(-5);
  const previous = volumes.slice(-10, -5);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  const change = ((recentAvg - previousAvg) / previousAvg) * 100;

  if (change > 15) return 'increasing';
  if (change < -15) return 'decreasing';
  return 'stable';
}

function calculateMomentum(prices: number[]): number {
  if (prices.length < 10) return 0;

  const current = prices[prices.length - 1];
  const past = prices[prices.length - 10];

  return ((current - past) / past) * 100;
}

function analyzeTechnicalIndicators(
  closePrices: number[],
  volumes: number[]
): TechnicalIndicators {
  return {
    rsi: calculateRSI(closePrices),
    macdSignal: calculateMACD(closePrices),
    volumeTrend: analyzeVolumeTrend(volumes),
    priceAction: analyzePriceAction(closePrices),
    momentum: calculateMomentum(closePrices),
  };
}

// ─── SMC: Volume Spike Analysis ───────────────────────────────────────────────

interface VolumeSpikeResult {
  detected: boolean;
  direction: 'bullish' | 'bearish' | 'neutral';
  spikeRatio: number;
  label: string;
  weight: number;
}

function analyzeVolumeSpike(klines: BinanceKline[]): VolumeSpikeResult {
  if (klines.length < 22) return { detected: false, direction: 'neutral', spikeRatio: 1, label: 'Volume Spike', weight: 0 };

  const volumes = klines.map((k) => k.volume);
  const recent20Avg = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const lastCandle = klines[klines.length - 1];
  const spikeRatio = lastVolume / (recent20Avg || 1);

  if (spikeRatio >= 2) {
    const direction = lastCandle.close > lastCandle.open ? 'bullish' : 'bearish';
    return {
      detected: true,
      direction,
      spikeRatio,
      label: 'Volume Spike',
      weight: 15,
    };
  }

  return { detected: false, direction: 'neutral', spikeRatio, label: 'Volume Spike', weight: 0 };
}

// ─── SMC: FVG Imbalance Count ─────────────────────────────────────────────────

interface FVGImbalanceResult {
  bullishCount: number;
  bearishCount: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  label: string;
  weight: number;
}

function analyzeFVGImbalance(klines: BinanceKline[]): FVGImbalanceResult {
  const fvgs = detectFVGs(klines.slice(-50));
  const openFVGs = fvgs.filter((f) => !f.filled);
  const bullishCount = openFVGs.filter((f) => f.direction === 'bullish').length;
  const bearishCount = openFVGs.filter((f) => f.direction === 'bearish').length;

  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let weight = 0;

  if (bullishCount > bearishCount) {
    direction = 'bullish';
    weight = Math.min(12, (bullishCount - bearishCount) * 3);
  } else if (bearishCount > bullishCount) {
    direction = 'bearish';
    weight = Math.min(12, (bearishCount - bullishCount) * 3);
  }

  return { bullishCount, bearishCount, direction, label: 'FVG Imbalance', weight };
}

// ─── SMC: Liquidity Sweep Direction ──────────────────────────────────────────

interface LiquiditySweepResult {
  detected: boolean;
  direction: 'bullish' | 'bearish' | 'neutral';
  description: string;
  label: string;
  weight: number;
}

function analyzeLiquiditySweepDirection(klines: BinanceKline[]): LiquiditySweepResult {
  if (klines.length < 10) return { detected: false, direction: 'neutral', description: '', label: 'Liquidity Sweep', weight: 0 };

  const swings = detectSwingPoints(klines, 3);
  const recentHighs = swings.filter((s) => s.type === 'high').slice(-3);
  const recentLows = swings.filter((s) => s.type === 'low').slice(-3);
  const recent = klines.slice(-10);

  // Bullish sweep: price swept below equal lows and recovered (bullish manipulation resolved)
  for (const swing of recentLows.reverse()) {
    const sweepCandle = recent.find((k) => k.low < swing.price && k.close > swing.price);
    if (sweepCandle) {
      return {
        detected: true,
        direction: 'bullish',
        description: `Equal lows swept at ${swing.price.toFixed(4)}, price recovered — bullish manipulation resolved`,
        label: 'Liquidity Sweep',
        weight: 12,
      };
    }
  }

  // Bearish sweep: price swept above equal highs and rejected (bearish manipulation resolved)
  for (const swing of recentHighs.reverse()) {
    const sweepCandle = recent.find((k) => k.high > swing.price && k.close < swing.price);
    if (sweepCandle) {
      return {
        detected: true,
        direction: 'bearish',
        description: `Equal highs swept at ${swing.price.toFixed(4)}, price rejected — bearish manipulation resolved`,
        label: 'Liquidity Sweep',
        weight: 12,
      };
    }
  }

  return { detected: false, direction: 'neutral', description: 'No recent liquidity sweep detected', label: 'Liquidity Sweep', weight: 0 };
}

// ─── SMC: Wyckoff Phase Factor ────────────────────────────────────────────────

interface WyckoffResult {
  phase: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  label: string;
  weight: number;
  detectable: boolean;
}

function analyzeWyckoffPhase(klines: BinanceKline[]): WyckoffResult {
  const volumes = klines.map((k) => k.volume);
  const phase = estimateWyckoffPhase(klines, volumes);

  if (phase === 'accumulation') {
    return { phase, direction: 'bullish', label: 'Wyckoff Phase', weight: 10, detectable: true };
  }
  if (phase === 'markup') {
    return { phase, direction: 'bullish', label: 'Wyckoff Phase', weight: 8, detectable: true };
  }
  if (phase === 'distribution') {
    return { phase, direction: 'bearish', label: 'Wyckoff Phase', weight: 10, detectable: true };
  }
  if (phase === 'markdown') {
    return { phase, direction: 'bearish', label: 'Wyckoff Phase', weight: 8, detectable: true };
  }

  return { phase: 'unknown', direction: 'neutral', label: 'Wyckoff Phase', weight: 0, detectable: false };
}

// ─── Main Sentiment Analysis ──────────────────────────────────────────────────

export function analyzeSentiment(
  closePrices: number[],
  volumes: number[],
  klines?: BinanceKline[]
): SentimentAnalysis {
  const indicators = analyzeTechnicalIndicators(closePrices, volumes);
  const factors: SentimentFactor[] = [];

  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;

  // ─── Classic indicators ────────────────────────────────────────────────────

  // RSI Analysis (weight: 20)
  const rsiWeight = 20;
  if (indicators.rsi < 30) {
    factors.push({ indicator: 'RSI', value: `${indicators.rsi.toFixed(1)} (Oversold)`, impact: 'positive' });
    bullishScore += rsiWeight;
  } else if (indicators.rsi > 70) {
    factors.push({ indicator: 'RSI', value: `${indicators.rsi.toFixed(1)} (Overbought)`, impact: 'negative' });
    bearishScore += rsiWeight;
  } else {
    factors.push({ indicator: 'RSI', value: `${indicators.rsi.toFixed(1)} (Neutral)`, impact: 'neutral' });
  }
  totalWeight += rsiWeight;

  // MACD Analysis (weight: 20)
  const macdWeight = 20;
  if (indicators.macdSignal === 'bullish') {
    factors.push({ indicator: 'MACD', value: 'Bullish crossover', impact: 'positive' });
    bullishScore += macdWeight;
  } else if (indicators.macdSignal === 'bearish') {
    factors.push({ indicator: 'MACD', value: 'Bearish crossover', impact: 'negative' });
    bearishScore += macdWeight;
  } else {
    factors.push({ indicator: 'MACD', value: 'No clear signal', impact: 'neutral' });
  }
  totalWeight += macdWeight;

  // Price Action (weight: 15)
  const paWeight = 15;
  if (indicators.priceAction === 'uptrend') {
    factors.push({ indicator: 'Price Action', value: 'Uptrend detected', impact: 'positive' });
    bullishScore += paWeight;
  } else if (indicators.priceAction === 'downtrend') {
    factors.push({ indicator: 'Price Action', value: 'Downtrend detected', impact: 'negative' });
    bearishScore += paWeight;
  } else {
    factors.push({ indicator: 'Price Action', value: 'Sideways movement', impact: 'neutral' });
  }
  totalWeight += paWeight;

  // Volume Trend (weight: 10)
  const volWeight = 10;
  if (indicators.volumeTrend === 'increasing' && indicators.momentum > 0) {
    factors.push({ indicator: 'Volume', value: 'Increasing with upward momentum', impact: 'positive' });
    bullishScore += volWeight;
  } else if (indicators.volumeTrend === 'increasing' && indicators.momentum < 0) {
    factors.push({ indicator: 'Volume', value: 'Increasing with downward momentum', impact: 'negative' });
    bearishScore += volWeight;
  } else {
    factors.push({ indicator: 'Volume', value: `${indicators.volumeTrend} volume`, impact: 'neutral' });
  }
  totalWeight += volWeight;

  // Momentum (weight: 5)
  const momWeight = 5;
  if (Math.abs(indicators.momentum) > 5) {
    factors.push({
      indicator: 'Momentum',
      value: `${indicators.momentum > 0 ? '+' : ''}${indicators.momentum.toFixed(2)}%`,
      impact: indicators.momentum > 0 ? 'positive' : 'negative',
    });
    if (indicators.momentum > 0) bullishScore += momWeight;
    else bearishScore += momWeight;
  } else {
    factors.push({ indicator: 'Momentum', value: `${indicators.momentum.toFixed(2)}%`, impact: 'neutral' });
  }
  totalWeight += momWeight;

  // ─── SMC / Institutional Order Flow indicators ─────────────────────────────

  if (klines && klines.length >= 22) {
    // Volume Spike Analysis (weight: 15)
    const volSpike = analyzeVolumeSpike(klines);
    if (volSpike.detected) {
      factors.push({
        indicator: volSpike.label,
        value: `${volSpike.spikeRatio.toFixed(1)}x avg volume — ${volSpike.direction} candle`,
        impact: volSpike.direction === 'bullish' ? 'positive' : 'negative',
      });
      if (volSpike.direction === 'bullish') bullishScore += volSpike.weight;
      else if (volSpike.direction === 'bearish') bearishScore += volSpike.weight;
      totalWeight += volSpike.weight;
    }

    // FVG Imbalance Count (weight: up to 12)
    const fvgImbalance = analyzeFVGImbalance(klines);
    if (fvgImbalance.direction !== 'neutral') {
      const fvgDesc = `${fvgImbalance.bullishCount} bullish / ${fvgImbalance.bearishCount} bearish open FVGs`;
      factors.push({
        indicator: fvgImbalance.label,
        value: fvgDesc,
        impact: fvgImbalance.direction === 'bullish' ? 'positive' : 'negative',
      });
      if (fvgImbalance.direction === 'bullish') bullishScore += fvgImbalance.weight;
      else bearishScore += fvgImbalance.weight;
      totalWeight += fvgImbalance.weight;
    }

    // Liquidity Sweep Direction (weight: 12)
    const liqSweep = analyzeLiquiditySweepDirection(klines);
    if (liqSweep.detected) {
      factors.push({
        indicator: liqSweep.label,
        value: liqSweep.description,
        impact: liqSweep.direction === 'bullish' ? 'positive' : 'negative',
      });
      if (liqSweep.direction === 'bullish') bullishScore += liqSweep.weight;
      else if (liqSweep.direction === 'bearish') bearishScore += liqSweep.weight;
      totalWeight += liqSweep.weight;
    }

    // Wyckoff Phase Estimation (weight: up to 10)
    const wyckoff = analyzeWyckoffPhase(klines);
    if (wyckoff.detectable) {
      factors.push({
        indicator: wyckoff.label,
        value: `${wyckoff.phase.charAt(0).toUpperCase() + wyckoff.phase.slice(1)} phase detected`,
        impact: wyckoff.direction === 'bullish' ? 'positive' : wyckoff.direction === 'bearish' ? 'negative' : 'neutral',
      });
      if (wyckoff.direction === 'bullish') bullishScore += wyckoff.weight;
      else if (wyckoff.direction === 'bearish') bearishScore += wyckoff.weight;
      totalWeight += wyckoff.weight;
    }
  }

  // ─── Final score calculation ───────────────────────────────────────────────
  const netScore = bullishScore - bearishScore;
  const strength = totalWeight > 0 ? Math.min(100, Math.round((Math.abs(netScore) / totalWeight) * 100)) : 0;

  let score: SentimentAnalysis['score'];
  if (netScore > totalWeight * 0.1) score = 'bullish';
  else if (netScore < -totalWeight * 0.1) score = 'bearish';
  else score = 'neutral';

  return {
    score,
    strength,
    factors,
    timestamp: Date.now(),
  };
}
