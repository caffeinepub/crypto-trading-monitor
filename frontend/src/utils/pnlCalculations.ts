import { PositionType } from '../types/position';

export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType
): { pnlUSD: number; pnlPercent: number } {
  const priceChange = currentPrice - entryPrice;
  const priceChangePercent = (priceChange / entryPrice) * 100;

  let pnlPercent: number;
  if (positionType === 'Long') {
    pnlPercent = priceChangePercent * leverage;
  } else {
    pnlPercent = -priceChangePercent * leverage;
  }

  const pnlUSD = (investmentAmount * pnlPercent) / 100;

  return { pnlUSD, pnlPercent };
}

export function calculateDistance(currentPrice: number, targetPrice: number): number {
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}
