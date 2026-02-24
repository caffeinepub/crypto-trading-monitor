export interface ExposureByAsset {
  symbol: string;
  percentage: number;
  capitalDeployed: number;
}

export interface LongShortBalance {
  longCount: number;
  shortCount: number;
  longCapital: number;
  shortCapital: number;
}

export interface CorrelationRisk {
  positions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

export interface PortfolioExposure {
  totalCapitalDeployed: number;
  totalLeverageExposure: number;
  weightedAverageLeverage: number;
  potentialProfit: number;
  potentialLoss: number;
  exposureByAsset: ExposureByAsset[];
  longShortBalance: LongShortBalance;
  correlationRisks: CorrelationRisk[];
  warningFlags: {
    highExposure: boolean;
    highCorrelation: boolean;
    imbalancedPositions: boolean;
  };
}
