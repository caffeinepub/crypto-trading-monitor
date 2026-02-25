export type RecoveryStrategyType = 'hedge' | 'dca' | 'partial_close' | 'tp_sl_adjustment';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface HedgeParams {
  hedgeSizePct: number;       // % of original position to hedge
  hedgeDirection: 'Long' | 'Short';
  suggestedLeverage: number;
  estimatedHedgeCost: number; // USD
}

export interface DCAParams {
  additionalEntryPrice: number;
  additionalInvestment: number; // USD
  newAverageEntry: number;
  breakEvenPrice: number;
}

export interface PartialCloseParams {
  closePct: number;           // % of position to close
  capitalRecovered: number;   // USD
  remainingExposure: number;  // USD
}

export interface TPSLAdjustmentParams {
  newTP: number;
  newSL: number;
  tpDistancePct: number;
  slDistancePct: number;
  atrUsed: number;
}

export type RecommendedParams =
  | HedgeParams
  | DCAParams
  | PartialCloseParams
  | TPSLAdjustmentParams;

export interface RecoveryStrategy {
  strategyType: RecoveryStrategyType;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  estimatedRecoveryPct: number; // estimated % of loss that can be recovered
  actionableSteps: string[];
  recommendedParams: RecommendedParams;
}

export interface PositionRecoveryInput {
  symbol: string;
  positionType: 'Long' | 'Short';
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  investmentAmount: number;
  stopLossPrice: number;
  takeProfitPrice?: number;
  totalExposure?: number;
}
