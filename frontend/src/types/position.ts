import { BinanceOrderIds } from './binanceApi';

export type PositionType = 'Long' | 'Short';

export interface TakeProfitLevel {
  level: number;
  price: number;
  profitUSD: number;
  profitPercent: number;
  reasoning: string;
}

export interface StopLossRecommendation {
  price: number;
  lossUSD: number;
  lossPercent: number;
  capitalRiskPercent: number;
  reasoning: string;
  partialTakingStrategy: string;
}

export interface Position {
  id: string;
  symbol: string;
  positionType: PositionType;
  leverage: number;
  entryPrice: number;
  investmentAmount: number;
  totalExposure: number;
  takeProfitLevels: TakeProfitLevel[];
  stopLoss: StopLossRecommendation;
  timestamp: number;
  binanceOrderIds?: BinanceOrderIds;
}

export interface PositionWithPrice extends Position {
  currentPrice: number;
  pnlUSD: number;
  pnlPercent: number;
  distanceToTP1: number;
  distanceToSL: number;
}
