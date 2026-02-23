import { AdjustmentSuggestion } from '../types/adjustment';
import { PositionWithPrice } from '../types/position';

interface MarketConditions {
  volatility: number;
  atr: number;
  priceChange24h: number;
  nearSupport: boolean;
  nearResistance: boolean;
}

function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const high = Math.max(prices[i], prices[i - 1]);
    const low = Math.min(prices[i], prices[i - 1]);
    trueRanges.push(high - low);
  }

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

function analyzeMarketConditions(
  prices: number[],
  currentPrice: number
): MarketConditions {
  const atr = calculateATR(prices);
  const volatility = (atr / currentPrice) * 100;

  const price24hAgo = prices[Math.max(0, prices.length - 24)];
  const priceChange24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;

  // Support and resistance detection
  const recent50 = prices.slice(-50);
  const support = Math.min(...recent50);
  const resistance = Math.max(...recent50);

  const nearSupport = Math.abs((currentPrice - support) / support) < 0.02;
  const nearResistance = Math.abs((currentPrice - resistance) / resistance) < 0.02;

  return {
    volatility,
    atr,
    priceChange24h,
    nearSupport,
    nearResistance,
  };
}

export function generateAdjustmentSuggestions(
  position: PositionWithPrice,
  prices: number[]
): AdjustmentSuggestion[] {
  const suggestions: AdjustmentSuggestion[] = [];
  const conditions = analyzeMarketConditions(prices, position.currentPrice);

  // Check if volatility has increased significantly
  if (conditions.volatility > 3) {
    // Suggest widening stop-loss if volatility increased
    const currentSLDistance = Math.abs(
      (position.stopLoss.price - position.currentPrice) / position.currentPrice
    ) * 100;

    const suggestedSLDistance = currentSLDistance * 1.3; // Widen by 30%
    const newSLPrice =
      position.positionType === 'Long'
        ? position.currentPrice * (1 - suggestedSLDistance / 100)
        : position.currentPrice * (1 + suggestedSLDistance / 100);

    if (Math.abs(newSLPrice - position.stopLoss.price) / position.stopLoss.price > 0.05) {
      suggestions.push({
        positionId: position.id,
        type: 'stop-loss',
        currentLevel: position.stopLoss.price,
        proposedLevel: newSLPrice,
        reasoning: `Market volatility increased to ${conditions.volatility.toFixed(2)}%. Widening stop-loss to avoid premature exit while maintaining risk management.`,
        confidence: 75,
        timestamp: Date.now(),
      });
    }
  }

  // Check if price is near support/resistance
  if (position.positionType === 'Long' && conditions.nearResistance) {
    const firstTP = position.takeProfitLevels[0];
    if (firstTP && position.currentPrice > firstTP.price * 0.95) {
      const newTPPrice = position.currentPrice * 1.02; // 2% above current

      suggestions.push({
        positionId: position.id,
        type: 'take-profit',
        currentLevel: firstTP.price,
        proposedLevel: newTPPrice,
        reasoning: 'Price approaching resistance level. Consider taking partial profits to secure gains.',
        confidence: 70,
        timestamp: Date.now(),
      });
    }
  }

  if (position.positionType === 'Short' && conditions.nearSupport) {
    const firstTP = position.takeProfitLevels[0];
    if (firstTP && position.currentPrice < firstTP.price * 1.05) {
      const newTPPrice = position.currentPrice * 0.98; // 2% below current

      suggestions.push({
        positionId: position.id,
        type: 'take-profit',
        currentLevel: firstTP.price,
        proposedLevel: newTPPrice,
        reasoning: 'Price approaching support level. Consider taking partial profits to secure gains.',
        confidence: 70,
        timestamp: Date.now(),
      });
    }
  }

  // Check for strong momentum - suggest trailing stop
  if (Math.abs(conditions.priceChange24h) > 5) {
    const isPositiveMomentum =
      (position.positionType === 'Long' && conditions.priceChange24h > 0) ||
      (position.positionType === 'Short' && conditions.priceChange24h < 0);

    if (isPositiveMomentum && position.pnlPercent > 10) {
      const trailingDistance = conditions.atr * 2;
      const newSLPrice =
        position.positionType === 'Long'
          ? position.currentPrice - trailingDistance
          : position.currentPrice + trailingDistance;

      // Only suggest if new SL is better than current
      const isBetterSL =
        position.positionType === 'Long'
          ? newSLPrice > position.stopLoss.price
          : newSLPrice < position.stopLoss.price;

      if (isBetterSL) {
        suggestions.push({
          positionId: position.id,
          type: 'stop-loss',
          currentLevel: position.stopLoss.price,
          proposedLevel: newSLPrice,
          reasoning: `Strong ${Math.abs(conditions.priceChange24h).toFixed(1)}% momentum in your favor. Move stop-loss to lock in profits while allowing position to run.`,
          confidence: 80,
          timestamp: Date.now(),
        });
      }
    }
  }

  return suggestions;
}
