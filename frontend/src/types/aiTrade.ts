export type TradingModality = 'Scalping' | 'DayTrading' | 'SwingTrading' | 'TrendFollowing';
export type TradeStatus = 'Open' | 'Closed' | 'TPHit' | 'SLHit';
export type RiskManagementStep = 'initial' | 'breakeven' | 'trailing' | 'closed';

export interface AITrade {
  id: string;
  symbol: string;
  positionType: 'Long' | 'Short';
  entryPrice: number;
  leverage: number;
  investmentAmount: number;
  tp1: number;
  tp2: number;
  tp3: number;
  stopLoss: number;
  status: TradeStatus;
  timestamp: number;
  modality: TradingModality;
  reasoning: string;
  utcDate: string; // YYYY-MM-DD

  // TP execution state (optional for backward compatibility)
  tp1Executed?: boolean;
  tp2Executed?: boolean;
  tp3Executed?: boolean;
  effectiveSL?: number; // starts equal to stopLoss, moves to breakeven/trailing
  riskManagementStep?: RiskManagementStep;

  // Reversal detection state (optional for backward compatibility)
  reversalDetected?: boolean;
  reversalConfidence?: number; // 0-100
  reversalReason?: string;
  reversalAction?: 'close' | 'reverse' | 'tighten_sl' | 'none';
  profitProtectionSL?: number; // stop-loss price set by reversal protection logic
}

export interface AITradeWithPrice extends AITrade {
  currentPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  // Resolved (non-optional) execution state for UI consumption
  tp1Executed: boolean;
  tp2Executed: boolean;
  tp3Executed: boolean;
  effectiveSL: number;
  riskManagementStep: RiskManagementStep;
  // Resolved reversal state for UI consumption
  reversalDetected: boolean;
  reversalConfidence: number;
  reversalReason: string;
  reversalAction: 'close' | 'reverse' | 'tighten_sl' | 'none';
}
