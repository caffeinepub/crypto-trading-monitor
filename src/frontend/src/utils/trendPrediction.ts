import { TrendPrediction, TrendDirection } from '../types/prediction';

interface TrendIndicators {
  shortTermTrend: number;
  mediumTermTrend: number;
  volatility: number;
  momentum: number;
  support: number;
  resistance: number;
}

function calculateTrendIndicators(
  prices: number[],
  shortTermPeriod: number,
  mediumTermPeriod: number
): TrendIndicators {
  const currentPrice = prices[prices.length - 1];

  // Short-term trend (recent price movement)
  const shortTermPrices = prices.slice(-shortTermPeriod);
  const shortTermAvg = shortTermPrices.reduce((a, b) => a + b, 0) / shortTermPrices.length;
  const shortTermTrend = ((currentPrice - shortTermAvg) / shortTermAvg) * 100;

  // Medium-term trend
  const mediumTermPrices = prices.slice(-mediumTermPeriod);
  const mediumTermAvg = mediumTermPrices.reduce((a, b) => a + b, 0) / mediumTermPrices.length;
  const mediumTermTrend = ((currentPrice - mediumTermAvg) / mediumTermAvg) * 100;

  // Volatility (standard deviation)
  const recentPrices = prices.slice(-20);
  const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / recentPrices.length;
  const volatility = Math.sqrt(variance) / mean * 100;

  // Momentum
  const momentum = ((prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10]) * 100;

  // Support and resistance (simplified)
  const recent50 = prices.slice(-50);
  const support = Math.min(...recent50);
  const resistance = Math.max(...recent50);

  return {
    shortTermTrend,
    mediumTermTrend,
    volatility,
    momentum,
    support,
    resistance,
  };
}

function predictDirection(
  trendValue: number,
  momentum: number,
  volatility: number
): { direction: TrendDirection; confidence: number } {
  let direction: TrendDirection;
  let confidence: number;

  const combinedSignal = trendValue * 0.6 + momentum * 0.4;

  if (Math.abs(combinedSignal) < 1) {
    direction = 'sideways';
    confidence = 50 + (volatility < 2 ? 20 : 0);
  } else if (combinedSignal > 0) {
    direction = 'up';
    confidence = Math.min(95, 50 + Math.abs(combinedSignal) * 8);
  } else {
    direction = 'down';
    confidence = Math.min(95, 50 + Math.abs(combinedSignal) * 8);
  }

  // Adjust confidence based on volatility
  if (volatility > 5) {
    confidence = Math.max(40, confidence - 15);
  }

  return { direction, confidence: Math.round(confidence) };
}

export function predictTrend(
  hourlyPrices: number[],
  dailyPrices: number[]
): { shortTerm: TrendPrediction; mediumTerm: TrendPrediction } {
  // Short-term prediction (1-24 hours) using hourly data
  const shortTermIndicators = calculateTrendIndicators(hourlyPrices, 6, 24);
  const shortTermPrediction = predictDirection(
    shortTermIndicators.shortTermTrend,
    shortTermIndicators.momentum,
    shortTermIndicators.volatility
  );

  // Medium-term prediction (1-7 days) using daily data
  const mediumTermIndicators = calculateTrendIndicators(dailyPrices, 3, 7);
  const mediumTermPrediction = predictDirection(
    mediumTermIndicators.mediumTermTrend,
    mediumTermIndicators.momentum,
    mediumTermIndicators.volatility
  );

  return {
    shortTerm: {
      direction: shortTermPrediction.direction,
      confidence: shortTermPrediction.confidence,
      timeHorizon: 'short-term',
      timeLabel: '1-24 hours',
      timestamp: Date.now(),
    },
    mediumTerm: {
      direction: mediumTermPrediction.direction,
      confidence: mediumTermPrediction.confidence,
      timeHorizon: 'medium-term',
      timeLabel: '1-7 days',
      timestamp: Date.now(),
    },
  };
}
