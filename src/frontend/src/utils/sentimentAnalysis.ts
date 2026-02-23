import { SentimentAnalysis, SentimentScore, SentimentFactor } from '../types/sentiment';

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

export function analyzeSentiment(
  closePrices: number[],
  volumes: number[]
): SentimentAnalysis {
  const indicators = analyzeTechnicalIndicators(closePrices, volumes);
  const factors: SentimentFactor[] = [];

  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;

  // RSI Analysis
  if (indicators.rsi < 30) {
    factors.push({
      indicator: 'RSI',
      value: `${indicators.rsi.toFixed(1)} (Oversold)`,
      impact: 'positive',
    });
    bullishSignals += 2;
  } else if (indicators.rsi > 70) {
    factors.push({
      indicator: 'RSI',
      value: `${indicators.rsi.toFixed(1)} (Overbought)`,
      impact: 'negative',
    });
    bearishSignals += 2;
  } else {
    factors.push({
      indicator: 'RSI',
      value: `${indicators.rsi.toFixed(1)} (Neutral)`,
      impact: 'neutral',
    });
  }
  totalSignals += 2;

  // MACD Analysis
  if (indicators.macdSignal === 'bullish') {
    factors.push({
      indicator: 'MACD',
      value: 'Bullish crossover',
      impact: 'positive',
    });
    bullishSignals += 2;
  } else if (indicators.macdSignal === 'bearish') {
    factors.push({
      indicator: 'MACD',
      value: 'Bearish crossover',
      impact: 'negative',
    });
    bearishSignals += 2;
  } else {
    factors.push({
      indicator: 'MACD',
      value: 'No clear signal',
      impact: 'neutral',
    });
  }
  totalSignals += 2;

  // Price Action
  if (indicators.priceAction === 'uptrend') {
    factors.push({
      indicator: 'Price Action',
      value: 'Uptrend detected',
      impact: 'positive',
    });
    bullishSignals += 1.5;
  } else if (indicators.priceAction === 'downtrend') {
    factors.push({
      indicator: 'Price Action',
      value: 'Downtrend detected',
      impact: 'negative',
    });
    bearishSignals += 1.5;
  } else {
    factors.push({
      indicator: 'Price Action',
      value: 'Sideways movement',
      impact: 'neutral',
    });
  }
  totalSignals += 1.5;

  // Volume Trend
  if (indicators.volumeTrend === 'increasing' && indicators.momentum > 0) {
    factors.push({
      indicator: 'Volume',
      value: 'Increasing with upward momentum',
      impact: 'positive',
    });
    bullishSignals += 1;
  } else if (indicators.volumeTrend === 'increasing' && indicators.momentum < 0) {
    factors.push({
      indicator: 'Volume',
      value: 'Increasing with downward momentum',
      impact: 'negative',
    });
    bearishSignals += 1;
  } else {
    factors.push({
      indicator: 'Volume',
      value: `${indicators.volumeTrend} volume`,
      impact: 'neutral',
    });
  }
  totalSignals += 1;

  // Momentum
  if (Math.abs(indicators.momentum) > 5) {
    factors.push({
      indicator: 'Momentum',
      value: `${indicators.momentum > 0 ? '+' : ''}${indicators.momentum.toFixed(2)}%`,
      impact: indicators.momentum > 0 ? 'positive' : 'negative',
    });
    if (indicators.momentum > 0) bullishSignals += 0.5;
    else bearishSignals += 0.5;
  }
  totalSignals += 0.5;

  // Calculate sentiment score and strength
  const netSignal = bullishSignals - bearishSignals;
  const strength = Math.min(100, (Math.abs(netSignal) / totalSignals) * 100);

  let score: SentimentScore;
  if (netSignal > 1) score = 'bullish';
  else if (netSignal < -1) score = 'bearish';
  else score = 'neutral';

  return {
    score,
    strength: Math.round(strength),
    factors,
    timestamp: Date.now(),
  };
}
