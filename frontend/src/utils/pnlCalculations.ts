import { PositionType } from '../types/position';

/**
 * Legacy export used by usePositionMonitoring, TradeOutcomeModal, and scenarioSimulator.
 * Returns { pnlUSD, pnlPercent } — treats invalid/zero currentPrice as 0 PnL.
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType
): { pnlUSD: number; pnlPercent: number } {
  if (!currentPrice || currentPrice === 0 || !entryPrice || entryPrice === 0) {
    return { pnlUSD: 0, pnlPercent: 0 };
  }

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

/**
 * New nullable variant used by AI trade monitoring.
 * Returns null values when currentPrice is 0/null/undefined so callers can
 * distinguish "no price yet" from "zero PnL".
 */
export function calculatePnl(
  entryPrice: number,
  currentPrice: number | null | undefined,
  investmentAmount: number,
  leverage: number,
  positionType: 'Long' | 'Short'
): { pnlUsd: number | null; pnlPercent: number | null } {
  if (!currentPrice || currentPrice === 0 || !entryPrice || entryPrice === 0) {
    return { pnlUsd: null, pnlPercent: null };
  }

  const priceChange = currentPrice - entryPrice;
  const priceChangePercent = (priceChange / entryPrice) * 100;

  let pnlPercent: number;
  if (positionType === 'Long') {
    pnlPercent = priceChangePercent * leverage;
  } else {
    pnlPercent = -priceChangePercent * leverage;
  }

  const pnlUsd = (investmentAmount * pnlPercent) / 100;

  return { pnlUsd, pnlPercent };
}

export function calculateDistance(currentPrice: number, targetPrice: number): number {
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}
