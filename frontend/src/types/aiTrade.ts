export type TradingModality = 'Scalping' | 'DayTrading' | 'SwingTrading' | 'TrendFollowing';
export type TradeStatus = 'Open' | 'Closed' | 'TPHit' | 'SLHit';

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
}

export interface AITradeWithPrice extends AITrade {
  currentPrice: number;
  pnlUsd: number;
  pnlPercent: number;
}
