import type { Position } from '../types/position';

export interface PnLResult {
  pnlUsd: number;
  pnlPercent: number;
}

export function calculatePnL(position: Position, currentPrice: number): PnLResult {
  if (!currentPrice || currentPrice <= 0 || !position.entryPrice || position.entryPrice <= 0) {
    return { pnlUsd: 0, pnlPercent: 0 };
  }
  const direction = position.side === 'Long' ? 1 : -1;
  const pnlUsd = (currentPrice - position.entryPrice) * position.quantity * direction;
  const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100 * direction * position.leverage;
  return { pnlUsd, pnlPercent };
}
