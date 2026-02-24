import { ScenarioResult, PositionOutcome, ScenarioPreset } from '../types/scenario';
import { PositionWithPrice } from '../types/position';
import { calculatePnL } from './pnlCalculations';

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    name: 'Market Crash',
    percentageChange: -20,
    description: 'Simulate a 20% market downturn',
  },
  {
    name: 'Bull Run',
    percentageChange: 30,
    description: 'Simulate a 30% market rally',
  },
  {
    name: 'High Volatility Down',
    percentageChange: -15,
    description: 'Simulate 15% downward volatility',
  },
  {
    name: 'High Volatility Up',
    percentageChange: 15,
    description: 'Simulate 15% upward volatility',
  },
];

export function simulateScenario(
  positions: PositionWithPrice[],
  percentageChange: number
): ScenarioResult {
  const positionOutcomes: PositionOutcome[] = positions.map(position => {
    const simulatedPrice = position.currentPrice * (1 + percentageChange / 100);

    // Calculate P&L at simulated price
    const { pnlUSD, pnlPercent } = calculatePnL(
      position.entryPrice,
      simulatedPrice,
      position.investmentAmount,
      position.leverage,
      position.positionType
    );

    // Check if TP or SL would be hit
    let tpHit = false;
    let slHit = false;

    if (position.positionType === 'Long') {
      tpHit = position.takeProfitLevels.some(tp => simulatedPrice >= tp.price);
      slHit = simulatedPrice <= position.stopLoss.price;
    } else {
      tpHit = position.takeProfitLevels.some(tp => simulatedPrice <= tp.price);
      slHit = simulatedPrice >= position.stopLoss.price;
    }

    // Check liquidation risk (simplified: if loss exceeds 80% of investment)
    const liquidationRisk = Math.abs(pnlUSD) > position.investmentAmount * 0.8 && pnlUSD < 0;

    // If SL hit, use SL loss instead
    const finalPnL = slHit ? position.stopLoss.lossUSD : pnlUSD;
    const finalPnLPercent = slHit ? position.stopLoss.lossPercent : pnlPercent;

    // If TP hit, use first TP profit
    const tpPnL = tpHit && position.takeProfitLevels[0] ? position.takeProfitLevels[0].profitUSD : finalPnL;
    const tpPnLPercent = tpHit && position.takeProfitLevels[0] ? position.takeProfitLevels[0].profitPercent : finalPnLPercent;

    return {
      positionId: position.id,
      symbol: position.symbol,
      simulatedPrice,
      projectedPnL: tpHit ? tpPnL : finalPnL,
      projectedPnLPercent: tpHit ? tpPnLPercent : finalPnLPercent,
      tpHit,
      slHit,
      liquidationRisk,
    };
  });

  const totalImpactUSD = positionOutcomes.reduce((sum, outcome) => sum + outcome.projectedPnL, 0);
  const totalCapital = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
  const totalImpactPercent = totalCapital > 0 ? (totalImpactUSD / totalCapital) * 100 : 0;

  return {
    totalImpactUSD,
    totalImpactPercent,
    positionOutcomes,
  };
}
