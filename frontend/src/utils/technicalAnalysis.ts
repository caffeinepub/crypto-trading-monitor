export function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const high = Math.max(prices[i], prices[i - 1]);
    const low = Math.min(prices[i], prices[i - 1]);
    const tr = high - low;
    trueRanges.push(tr);
  }

  const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  return atr;
}

export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

export function findSupportResistance(prices: number[], currentPrice: number): {
  support: number[];
  resistance: number[];
} {
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const support: number[] = [];
  const resistance: number[] = [];

  // Find price levels with clustering
  const tolerance = currentPrice * 0.005; // 0.5% tolerance
  const clusters: number[][] = [];
  
  sortedPrices.forEach(price => {
    let addedToCluster = false;
    for (const cluster of clusters) {
      if (Math.abs(price - cluster[0]) <= tolerance) {
        cluster.push(price);
        addedToCluster = true;
        break;
      }
    }
    if (!addedToCluster) {
      clusters.push([price]);
    }
  });

  // Get significant levels (clusters with multiple touches)
  const significantLevels = clusters
    .filter(cluster => cluster.length >= 3)
    .map(cluster => cluster.reduce((sum, p) => sum + p, 0) / cluster.length);

  significantLevels.forEach(level => {
    if (level < currentPrice) {
      support.push(level);
    } else {
      resistance.push(level);
    }
  });

  return {
    support: support.slice(-3).reverse(),
    resistance: resistance.slice(0, 3),
  };
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  targetPrice: number,
  stopLoss: number
): number {
  const reward = Math.abs(targetPrice - entryPrice);
  const risk = Math.abs(entryPrice - stopLoss);
  return risk > 0 ? reward / risk : 0;
}
