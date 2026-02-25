import { fetchKlines, klinesToClosePrices } from '../services/binanceApi';
import { calculateATR, findSupportResistance } from './technicalAnalysis';
import {
  RecoveryStrategy,
  PositionRecoveryInput,
  HedgeParams,
  DCAParams,
  PartialCloseParams,
  TPSLAdjustmentParams,
} from '../types/recovery';

/**
 * Computes the current PnL percentage for a position.
 */
function computePnlPct(input: PositionRecoveryInput): number {
  const { entryPrice, currentPrice, leverage, positionType } = input;
  const priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100;
  return positionType === 'Long' ? priceChangePct * leverage : -priceChangePct * leverage;
}

/**
 * Hedge strategy: open an opposite position to neutralise further losses.
 */
function buildHedgeStrategy(
  input: PositionRecoveryInput,
  pnlPct: number
): RecoveryStrategy {
  const lossUSD = Math.abs((input.investmentAmount * pnlPct) / 100);
  const hedgeSizePct = Math.min(80, Math.abs(pnlPct) * 1.5); // hedge up to 80% of position
  const hedgeDirection: 'Long' | 'Short' = input.positionType === 'Long' ? 'Short' : 'Long';
  const estimatedHedgeCost = (input.investmentAmount * hedgeSizePct) / 100;
  const estimatedRecoveryPct = Math.min(60, hedgeSizePct * 0.7);

  const params: HedgeParams = {
    hedgeSizePct: Math.round(hedgeSizePct),
    hedgeDirection,
    suggestedLeverage: Math.min(input.leverage, 5),
    estimatedHedgeCost: Math.round(estimatedHedgeCost * 100) / 100,
  };

  return {
    strategyType: 'hedge',
    title: 'Hedge Position',
    description: `Open a ${hedgeDirection} position to offset further losses on your ${input.positionType} trade. This neutralises market exposure while you wait for a reversal.`,
    riskLevel: 'medium',
    estimatedRecoveryPct: Math.round(estimatedRecoveryPct),
    actionableSteps: [
      `Open a ${hedgeDirection} position on ${input.symbol} with ${Math.round(hedgeSizePct)}% of your current exposure (~$${estimatedHedgeCost.toFixed(2)}).`,
      `Use a lower leverage of ${Math.min(input.leverage, 5)}x to reduce liquidation risk on the hedge.`,
      `Set a tight stop-loss on the hedge at 1–2% from entry to cap hedge cost.`,
      `Monitor both positions; close the hedge when the original position recovers to break-even.`,
      `Avoid adding more capital until market direction becomes clearer.`,
    ],
    recommendedParams: params,
  };
}

/**
 * DCA strategy: average down the entry price with an additional buy.
 */
function buildDCAStrategy(
  input: PositionRecoveryInput,
  atr: number,
  support: number[],
  pnlPct: number
): RecoveryStrategy | null {
  // Only recommend DCA if loss is not catastrophic (< 50% loss) and there's a support level below
  if (Math.abs(pnlPct) > 50) return null;

  const { entryPrice, currentPrice, investmentAmount, positionType } = input;

  // For Long: DCA below current price; for Short: DCA above current price
  let dcaEntryPrice: number;
  if (positionType === 'Long') {
    // Use nearest support or ATR-based level
    const nearestSupport = support.find((s) => s < currentPrice);
    dcaEntryPrice = nearestSupport
      ? nearestSupport
      : currentPrice - atr * 1.5;
    if (dcaEntryPrice >= currentPrice) return null; // no valid DCA level
  } else {
    dcaEntryPrice = currentPrice + atr * 1.5;
  }

  // Additional investment = same as original (double down)
  const additionalInvestment = investmentAmount;
  const newAverageEntry = (entryPrice * investmentAmount + dcaEntryPrice * additionalInvestment) /
    (investmentAmount + additionalInvestment);

  // Break-even: price where total PnL = 0
  const breakEvenPrice = newAverageEntry;
  const estimatedRecoveryPct = Math.min(
    70,
    (Math.abs(entryPrice - newAverageEntry) / Math.abs(entryPrice - currentPrice)) * 100
  );

  const params: DCAParams = {
    additionalEntryPrice: Math.round(dcaEntryPrice * 10000) / 10000,
    additionalInvestment: Math.round(additionalInvestment * 100) / 100,
    newAverageEntry: Math.round(newAverageEntry * 10000) / 10000,
    breakEvenPrice: Math.round(breakEvenPrice * 10000) / 10000,
  };

  return {
    strategyType: 'dca',
    title: 'Dollar-Cost Average (DCA)',
    description: `Add to your ${positionType} position at a lower price to reduce your average entry and lower the break-even point. This strategy works best when you believe the trend will reverse.`,
    riskLevel: 'high',
    estimatedRecoveryPct: Math.round(estimatedRecoveryPct),
    actionableSteps: [
      `Wait for price to reach ~$${dcaEntryPrice.toFixed(4)} before adding to the position.`,
      `Add $${additionalInvestment.toFixed(2)} to bring your average entry to $${newAverageEntry.toFixed(4)}.`,
      `Your new break-even price will be $${breakEvenPrice.toFixed(4)}.`,
      `Set a new stop-loss below the DCA entry to protect against further downside.`,
      `Only DCA if you have strong conviction in the trade thesis — do NOT DCA into a broken trend.`,
    ],
    recommendedParams: params,
  };
}

/**
 * Partial close strategy: reduce exposure and lock in some capital.
 */
function buildPartialCloseStrategy(
  input: PositionRecoveryInput,
  pnlPct: number
): RecoveryStrategy {
  // Recommend closing 30–50% depending on severity of loss
  const closePct = Math.abs(pnlPct) > 30 ? 50 : 30;
  const capitalRecovered = (input.investmentAmount * closePct) / 100;
  const remainingExposure = input.totalExposure
    ? input.totalExposure * (1 - closePct / 100)
    : input.investmentAmount * input.leverage * (1 - closePct / 100);
  const estimatedRecoveryPct = closePct * 0.8; // partial recovery of capital

  const params: PartialCloseParams = {
    closePct,
    capitalRecovered: Math.round(capitalRecovered * 100) / 100,
    remainingExposure: Math.round(remainingExposure * 100) / 100,
  };

  return {
    strategyType: 'partial_close',
    title: 'Partial Position Close',
    description: `Close ${closePct}% of your position to reduce risk exposure and recover some capital. This limits further losses while keeping you in the trade for a potential recovery.`,
    riskLevel: 'low',
    estimatedRecoveryPct: Math.round(estimatedRecoveryPct),
    actionableSteps: [
      `Close ${closePct}% of your ${input.symbol} ${input.positionType} position at market price.`,
      `This recovers approximately $${capitalRecovered.toFixed(2)} of capital.`,
      `Remaining exposure will be ~$${remainingExposure.toFixed(2)}.`,
      `Move your stop-loss on the remaining position to break-even or tighter.`,
      `Re-evaluate the remaining position once market conditions stabilise.`,
    ],
    recommendedParams: params,
  };
}

/**
 * TP/SL adjustment strategy: use ATR to set realistic new levels.
 */
function buildTPSLAdjustmentStrategy(
  input: PositionRecoveryInput,
  atr: number,
  pnlPct: number
): RecoveryStrategy {
  const { currentPrice, positionType } = input;
  const atrMultiplierTP = 2.5;
  const atrMultiplierSL = 1.2;

  let newTP: number;
  let newSL: number;

  if (positionType === 'Long') {
    newTP = currentPrice + atr * atrMultiplierTP;
    newSL = currentPrice - atr * atrMultiplierSL;
  } else {
    newTP = currentPrice - atr * atrMultiplierTP;
    newSL = currentPrice + atr * atrMultiplierSL;
  }

  const tpDistancePct = (Math.abs(newTP - currentPrice) / currentPrice) * 100;
  const slDistancePct = (Math.abs(newSL - currentPrice) / currentPrice) * 100;
  const estimatedRecoveryPct = Math.min(80, tpDistancePct * input.leverage * 0.5);

  const params: TPSLAdjustmentParams = {
    newTP: Math.round(newTP * 10000) / 10000,
    newSL: Math.round(newSL * 10000) / 10000,
    tpDistancePct: Math.round(tpDistancePct * 100) / 100,
    slDistancePct: Math.round(slDistancePct * 100) / 100,
    atrUsed: Math.round(atr * 10000) / 10000,
  };

  return {
    strategyType: 'tp_sl_adjustment',
    title: 'Adjust TP/SL Levels',
    description: `Recalibrate your Take Profit and Stop Loss levels based on current ATR (${atr.toFixed(4)}) and market structure. This gives the trade more room to breathe while capping downside.`,
    riskLevel: 'low',
    estimatedRecoveryPct: Math.round(estimatedRecoveryPct),
    actionableSteps: [
      `Move your Take Profit to $${newTP.toFixed(4)} (${tpDistancePct.toFixed(2)}% from current price).`,
      `Tighten your Stop Loss to $${newSL.toFixed(4)} (${slDistancePct.toFixed(2)}% from current price).`,
      `Current ATR is $${atr.toFixed(4)} — levels are set at ${atrMultiplierTP}x ATR for TP and ${atrMultiplierSL}x ATR for SL.`,
      `This gives a risk/reward ratio of ${(tpDistancePct / slDistancePct).toFixed(2)}:1.`,
      `Review and adjust again if ATR changes significantly (high volatility events).`,
    ],
    recommendedParams: params,
  };
}

/**
 * Main recovery engine: fetches live data and returns applicable strategies.
 * Only call this when the position is confirmed to be in loss.
 */
export async function analyzePositionRecovery(
  input: PositionRecoveryInput & { totalExposure?: number }
): Promise<RecoveryStrategy[]> {
  const pnlPct = computePnlPct(input);

  // Safety guard: only run for losing positions
  if (pnlPct >= 0) return [];

  // Fetch klines for ATR and support/resistance
  let atr = 0;
  let support: number[] = [];

  try {
    const klines = await fetchKlines(input.symbol, '1h', 50);
    const closes = klinesToClosePrices(klines);
    atr = calculateATR(closes, 14);
    const sr = findSupportResistance(closes, input.currentPrice);
    support = sr.support;
  } catch {
    // Fallback: estimate ATR as 0.5% of current price
    atr = input.currentPrice * 0.005;
  }

  const strategies: RecoveryStrategy[] = [];

  // 1. TP/SL Adjustment — always applicable
  strategies.push(buildTPSLAdjustmentStrategy(input, atr, pnlPct));

  // 2. Partial Close — always applicable
  strategies.push(buildPartialCloseStrategy(input, pnlPct));

  // 3. Hedge — applicable when loss is significant
  if (Math.abs(pnlPct) >= 5) {
    strategies.push(buildHedgeStrategy(input, pnlPct));
  }

  // 4. DCA — only when loss is not catastrophic and there's a valid level
  const dcaStrategy = buildDCAStrategy(input, atr, support, pnlPct);
  if (dcaStrategy) {
    strategies.push(dcaStrategy);
  }

  // Sort by risk level: low → medium → high
  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  strategies.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

  return strategies;
}
