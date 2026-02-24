import { TakeProfitLevel, PositionType } from '../types/position';
import { findSupportResistance, calculateVolatility } from './technicalAnalysis';

export async function calculateTakeProfitLevels(
  symbol: string,
  entryPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType,
  historicalPrices: number[]
): Promise<TakeProfitLevel[]> {
  const volatility = calculateVolatility(historicalPrices);
  const { support, resistance } = findSupportResistance(historicalPrices, entryPrice);

  // Base multipliers adjusted for leverage and volatility
  const leverageFactor = Math.min(leverage / 10, 5); // Cap at 5x impact
  const volatilityFactor = Math.max(volatility / 2, 1);

  let tp1Multiplier = 0.015 * volatilityFactor; // 1.5% base
  let tp2Multiplier = 0.035 * volatilityFactor; // 3.5% base
  let tp3Multiplier = 0.06 * volatilityFactor; // 6% base

  // Adjust for high leverage (tighter targets)
  if (leverage > 20) {
    tp1Multiplier *= 0.7;
    tp2Multiplier *= 0.7;
    tp3Multiplier *= 0.7;
  }

  const takeProfitLevels: TakeProfitLevel[] = [];

  // TP1 - Conservative target
  let tp1Price: number;
  if (positionType === 'Long') {
    tp1Price = resistance[0] || entryPrice * (1 + tp1Multiplier);
  } else {
    tp1Price = support[0] || entryPrice * (1 - tp1Multiplier);
  }

  const tp1ProfitPercent = positionType === 'Long'
    ? ((tp1Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp1Price) / entryPrice) * 100 * leverage;
  
  takeProfitLevels.push({
    level: 1,
    price: tp1Price,
    profitUSD: (investmentAmount * tp1ProfitPercent) / 100,
    profitPercent: tp1ProfitPercent,
    reasoning: `First resistance level based on ${resistance[0] ? 'historical resistance' : 'technical analysis'}. Conservative target for partial profit taking (30-40% of position).`,
  });

  // TP2 - Moderate target
  let tp2Price: number;
  if (positionType === 'Long') {
    tp2Price = resistance[1] || entryPrice * (1 + tp2Multiplier);
  } else {
    tp2Price = support[1] || entryPrice * (1 - tp2Multiplier);
  }

  const tp2ProfitPercent = positionType === 'Long'
    ? ((tp2Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp2Price) / entryPrice) * 100 * leverage;

  takeProfitLevels.push({
    level: 2,
    price: tp2Price,
    profitUSD: (investmentAmount * tp2ProfitPercent) / 100,
    profitPercent: tp2ProfitPercent,
    reasoning: `Secondary target at key ${resistance[1] ? 'resistance zone' : 'Fibonacci extension'}. Fair Value Gap (FVG) consideration. Take 30-40% more profit here.`,
  });

  // TP3 - Aggressive target
  let tp3Price: number;
  if (positionType === 'Long') {
    tp3Price = resistance[2] || entryPrice * (1 + tp3Multiplier);
  } else {
    tp3Price = support[2] || entryPrice * (1 - tp3Multiplier);
  }

  const tp3ProfitPercent = positionType === 'Long'
    ? ((tp3Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp3Price) / entryPrice) * 100 * leverage;

  takeProfitLevels.push({
    level: 3,
    price: tp3Price,
    profitUSD: (investmentAmount * tp3ProfitPercent) / 100,
    profitPercent: tp3ProfitPercent,
    reasoning: `Extended target based on Smart Money Concepts (SMC) and market structure. High volatility zone - let remaining position (20-30%) run with trailing stop.`,
  });

  return takeProfitLevels;
}
