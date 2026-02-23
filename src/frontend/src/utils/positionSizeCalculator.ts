import { PositionSizeInputs, PositionSizeResult } from '../types/calculator';

export function calculatePositionSize(inputs: PositionSizeInputs): PositionSizeResult {
  const { capital, riskPercentage, stopLossPrice, entryPrice, leverage } = inputs;

  // Calculate risk amount in USD
  const riskAmount = capital * (riskPercentage / 100);

  // Calculate stop-loss distance as percentage
  const slDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice);

  // Calculate position size
  // Position size = Risk amount / (SL distance × leverage)
  const positionSize = riskAmount / slDistance;

  // Calculate number of contracts (assuming 1 contract = entry price value)
  const contracts = positionSize / entryPrice;

  // Calculate potential reward (assuming 2:1 risk-reward ratio)
  const rewardDistance = slDistance * 2;
  const rewardAmount = positionSize * rewardDistance;

  // Risk-reward ratio
  const riskRewardRatio = rewardAmount / riskAmount;

  return {
    positionSize: Math.round(positionSize * 100) / 100,
    contracts: Math.round(contracts * 1000) / 1000,
    riskAmount: Math.round(riskAmount * 100) / 100,
    rewardAmount: Math.round(rewardAmount * 100) / 100,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
  };
}
