import { StopLossRecommendation, PositionType } from '../types/position';
import { calculateATR, findSupportResistance } from './technicalAnalysis';

export async function calculateStopLoss(
  symbol: string,
  entryPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType,
  historicalPrices: number[]
): Promise<StopLossRecommendation> {
  const atr = calculateATR(historicalPrices);
  const { support, resistance } = findSupportResistance(historicalPrices, entryPrice);

  // Base risk percentage (tighter for higher leverage)
  let baseRiskPercent = 2; // 2% of capital at risk
  if (leverage > 50) {
    baseRiskPercent = 0.8;
  } else if (leverage > 20) {
    baseRiskPercent = 1.2;
  } else if (leverage > 10) {
    baseRiskPercent = 1.5;
  }

  // Calculate SL distance based on ATR and leverage
  const atrMultiplier = leverage > 20 ? 1.2 : leverage > 10 ? 1.5 : 2;
  const slDistance = (atr / entryPrice) * atrMultiplier;

  let slPrice: number;
  if (positionType === 'Long') {
    // For long, SL below entry, consider support levels
    const technicalSL = support[0] ? support[0] * 0.998 : entryPrice * (1 - slDistance);
    slPrice = Math.max(technicalSL, entryPrice * (1 - slDistance));
  } else {
    // For short, SL above entry, consider resistance levels
    const technicalSL = resistance[0] ? resistance[0] * 1.002 : entryPrice * (1 + slDistance);
    slPrice = Math.min(technicalSL, entryPrice * (1 + slDistance));
  }

  // Calculate loss
  const priceChangePercent = Math.abs((slPrice - entryPrice) / entryPrice) * 100;
  const lossPercent = priceChangePercent * leverage;
  const lossUSD = (investmentAmount * lossPercent) / 100;

  // Adjust SL if loss exceeds base risk
  const actualRiskPercent = (lossUSD / investmentAmount) * 100;
  if (actualRiskPercent > baseRiskPercent * 1.5) {
    const adjustedLossPercent = baseRiskPercent * 1.2;
    const adjustedPriceChange = adjustedLossPercent / leverage;
    if (positionType === 'Long') {
      slPrice = entryPrice * (1 - adjustedPriceChange / 100);
    } else {
      slPrice = entryPrice * (1 + adjustedPriceChange / 100);
    }
  }

  const finalLossPercent = Math.abs(((slPrice - entryPrice) / entryPrice) * 100 * leverage);
  const finalLossUSD = (investmentAmount * finalLossPercent) / 100;
  const capitalRiskPercent = (finalLossUSD / investmentAmount) * 100;

  const reasoning = `Stop-loss calculated using ${atrMultiplier}x ATR for ${leverage}x leverage. ${
    support[0] || resistance[0] ? 'Positioned beyond key support/resistance to avoid premature stops.' : 'Based on volatility analysis.'
  } Risk limited to ${capitalRiskPercent.toFixed(2)}% of capital.`;

  const partialTakingStrategy = `Recommended strategy: Take 30-40% profit at TP1, move SL to breakeven. Take another 30-40% at TP2, move SL to TP1. Let final 20-30% run to TP3 with trailing stop at TP2. This protects capital while maximizing upside potential.`;

  return {
    price: slPrice,
    lossUSD: finalLossUSD,
    lossPercent: finalLossPercent,
    capitalRiskPercent,
    reasoning,
    partialTakingStrategy,
  };
}
