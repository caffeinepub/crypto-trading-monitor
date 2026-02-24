export interface ScenarioInput {
  percentageChange: number;
}

export interface PositionOutcome {
  positionId: string;
  symbol: string;
  simulatedPrice: number;
  projectedPnL: number;
  projectedPnLPercent: number;
  tpHit: boolean;
  slHit: boolean;
  liquidationRisk: boolean;
}

export interface ScenarioResult {
  totalImpactUSD: number;
  totalImpactPercent: number;
  positionOutcomes: PositionOutcome[];
}

export interface ScenarioPreset {
  name: string;
  percentageChange: number;
  description: string;
}
