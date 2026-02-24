import { PortfolioExposure, ExposureByAsset, LongShortBalance, CorrelationRisk } from '../types/exposure';
import { PositionWithPrice } from '../types/position';

const CORRELATED_PAIRS = [
  ['BTCUSDT', 'ETHUSDT'],
  ['BTCUSDT', 'BNBUSDT'],
  ['ETHUSDT', 'BNBUSDT'],
  ['USDCUSDT', 'BUSDUSDT', 'TUSDUSDT'],
];

function detectCorrelatedPositions(positions: PositionWithPrice[]): CorrelationRisk[] {
  const risks: CorrelationRisk[] = [];
  const symbols = positions.map(p => p.symbol);

  for (const correlatedGroup of CORRELATED_PAIRS) {
    const matchingPositions = positions.filter(p => correlatedGroup.includes(p.symbol));

    if (matchingPositions.length >= 2) {
      const totalExposure = matchingPositions.reduce((sum, p) => sum + p.totalExposure, 0);
      const sameDirection = matchingPositions.every(p => p.positionType === matchingPositions[0].positionType);

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (sameDirection && matchingPositions.length >= 3) riskLevel = 'high';
      else if (sameDirection) riskLevel = 'medium';

      risks.push({
        positions: matchingPositions.map(p => p.symbol),
        riskLevel,
        description: sameDirection
          ? `${matchingPositions.length} correlated ${matchingPositions[0].positionType} positions with $${totalExposure.toFixed(0)} exposure`
          : `${matchingPositions.length} correlated positions with mixed directions`,
      });
    }
  }

  return risks;
}

export function calculatePortfolioExposure(positions: PositionWithPrice[]): PortfolioExposure {
  if (positions.length === 0) {
    return {
      totalCapitalDeployed: 0,
      totalLeverageExposure: 0,
      weightedAverageLeverage: 0,
      potentialProfit: 0,
      potentialLoss: 0,
      exposureByAsset: [],
      longShortBalance: {
        longCount: 0,
        shortCount: 0,
        longCapital: 0,
        shortCapital: 0,
      },
      correlationRisks: [],
      warningFlags: {
        highExposure: false,
        highCorrelation: false,
        imbalancedPositions: false,
      },
    };
  }

  // Total capital deployed
  const totalCapitalDeployed = positions.reduce((sum, p) => sum + p.investmentAmount, 0);

  // Total leverage exposure
  const totalLeverageExposure = positions.reduce((sum, p) => sum + p.totalExposure, 0);

  // Weighted average leverage
  const weightedAverageLeverage =
    positions.reduce((sum, p) => sum + p.leverage * p.investmentAmount, 0) / totalCapitalDeployed;

  // Potential profit (sum of first TP levels)
  const potentialProfit = positions.reduce((sum, p) => {
    const firstTP = p.takeProfitLevels[0];
    return sum + (firstTP ? firstTP.profitUSD : 0);
  }, 0);

  // Potential loss (sum of stop losses)
  const potentialLoss = positions.reduce((sum, p) => sum + Math.abs(p.stopLoss.lossUSD), 0);

  // Exposure by asset
  const assetMap = new Map<string, number>();
  positions.forEach(p => {
    const current = assetMap.get(p.symbol) || 0;
    assetMap.set(p.symbol, current + p.investmentAmount);
  });

  const exposureByAsset: ExposureByAsset[] = Array.from(assetMap.entries())
    .map(([symbol, capital]) => ({
      symbol,
      capitalDeployed: capital,
      percentage: (capital / totalCapitalDeployed) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Long/Short balance
  const longPositions = positions.filter(p => p.positionType === 'Long');
  const shortPositions = positions.filter(p => p.positionType === 'Short');

  const longShortBalance: LongShortBalance = {
    longCount: longPositions.length,
    shortCount: shortPositions.length,
    longCapital: longPositions.reduce((sum, p) => sum + p.investmentAmount, 0),
    shortCapital: shortPositions.reduce((sum, p) => sum + p.investmentAmount, 0),
  };

  // Correlation risks
  const correlationRisks = detectCorrelatedPositions(positions);

  // Warning flags
  const highExposure = totalLeverageExposure > totalCapitalDeployed * 5; // More than 5x average leverage
  const highCorrelation = correlationRisks.some(r => r.riskLevel === 'high');
  const imbalancedPositions =
    Math.abs(longShortBalance.longCapital - longShortBalance.shortCapital) >
    totalCapitalDeployed * 0.7;

  return {
    totalCapitalDeployed,
    totalLeverageExposure,
    weightedAverageLeverage: Math.round(weightedAverageLeverage * 10) / 10,
    potentialProfit,
    potentialLoss,
    exposureByAsset,
    longShortBalance,
    correlationRisks,
    warningFlags: {
      highExposure,
      highCorrelation,
      imbalancedPositions,
    },
  };
}
