export interface PositionSizeInputs {
  capital: number;
  riskPercentage: number;
  stopLossPrice: number;
  entryPrice: number;
  leverage: number;
}

export interface PositionSizeResult {
  positionSize: number;
  contracts: number;
  riskAmount: number;
  rewardAmount: number;
  riskRewardRatio: number;
}
