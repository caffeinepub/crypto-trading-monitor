export type TradeOutcome = 'TP Hit' | 'SL Hit' | 'Manually Closed';

export interface UserTradeRecord {
  id: string;
  symbol: string;
  positionType: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  investment: number;
  pnlUsd: number;
  pnlPercent: number;
  outcome: TradeOutcome;
  timestamp: number;
}

export interface AITradeRecord {
  id: string;
  symbol: string;
  modality: string;
  positionType: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  investment: number;
  pnlUsd: number;
  pnlPercent: number;
  outcome: 'TP Hit' | 'SL Hit';
  timestamp: number;
  outcomeNote?: string; // e.g. 'Closed by reversal detection'
}

export interface ModalityStats {
  modality: string;
  totalTrades: number;
  wins: number;
  winRate: number;
  totalPnl: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  wins: number;
  winRate: number;
  totalPnlUsd: number;
  modalityBreakdown?: ModalityStats[];
}
