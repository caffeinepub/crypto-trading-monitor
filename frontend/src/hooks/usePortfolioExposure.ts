import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PositionWithPrice } from '../types/position';
import { calculatePortfolioExposure } from '../utils/exposureCalculations';
import { PortfolioExposure } from '../types/exposure';
import { fetchCurrentPrices } from '../services/binanceApi';

export interface EnrichedPosition extends PositionWithPrice {
  livePrice: number | null;
  liveExposure: number | null;
  unrealizedPnlLive: number | null;
  unrealizedPnlLivePct: number | null;
  liquidationPrice: number | null;
  distanceToLiquidation: number | null;
  priceStale: boolean;
}

export function usePortfolioExposure(positions: PositionWithPrice[]): {
  exposure: PortfolioExposure;
  enrichedPositions: EnrichedPosition[];
  livePricesLoading: boolean;
  livePricesError: boolean;
} {
  const symbols = useMemo(() => [...new Set(positions.map((p) => p.symbol))], [positions]);

  const {
    data: livePricesData,
    isLoading: livePricesLoading,
    isError: livePricesError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['live-prices-risk', symbols],
    queryFn: () => fetchCurrentPrices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  const livePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (livePricesData) {
      livePricesData.forEach((p) => map.set(p.symbol, parseFloat(p.price)));
    }
    return map;
  }, [livePricesData]);

  const isStale = useMemo(() => {
    if (!dataUpdatedAt) return false;
    return Date.now() - dataUpdatedAt > 60_000;
  }, [dataUpdatedAt]);

  const enrichedPositions: EnrichedPosition[] = useMemo(() => {
    return positions.map((pos) => {
      const livePrice = livePriceMap.get(pos.symbol) ?? null;
      const priceStale = livePrice === null ? false : isStale;

      let liveExposure: number | null = null;
      let unrealizedPnlLive: number | null = null;
      let unrealizedPnlLivePct: number | null = null;
      let liquidationPrice: number | null = null;
      let distanceToLiquidation: number | null = null;

      if (livePrice !== null) {
        // Current exposure = quantity × live price
        const quantity = pos.totalExposure / pos.entryPrice;
        liveExposure = quantity * livePrice;

        // Unrealized PnL using live price
        const priceDiff = pos.positionType === 'Long'
          ? livePrice - pos.entryPrice
          : pos.entryPrice - livePrice;
        unrealizedPnlLive = (priceDiff / pos.entryPrice) * pos.investmentAmount * pos.leverage;
        unrealizedPnlLivePct = (priceDiff / pos.entryPrice) * pos.leverage * 100;

        // Estimated liquidation price (simplified formula)
        // Long: liqPrice = entryPrice × (1 - 1/leverage + maintMarginRatio)
        // Short: liqPrice = entryPrice × (1 + 1/leverage - maintMarginRatio)
        const maintMarginRatio = 0.004; // default 0.4% for most pairs
        if (pos.positionType === 'Long') {
          liquidationPrice = pos.entryPrice * (1 - 1 / pos.leverage + maintMarginRatio);
        } else {
          liquidationPrice = pos.entryPrice * (1 + 1 / pos.leverage - maintMarginRatio);
        }

        // Distance to liquidation as percentage from current price
        if (pos.positionType === 'Long') {
          distanceToLiquidation = ((livePrice - liquidationPrice) / livePrice) * 100;
        } else {
          distanceToLiquidation = ((liquidationPrice - livePrice) / livePrice) * 100;
        }
      }

      return {
        ...pos,
        livePrice,
        liveExposure,
        unrealizedPnlLive,
        unrealizedPnlLivePct,
        liquidationPrice,
        distanceToLiquidation,
        priceStale,
      };
    });
  }, [positions, livePriceMap, isStale]);

  const exposure = useMemo(() => {
    return calculatePortfolioExposure(positions);
  }, [positions]);

  return { exposure, enrichedPositions, livePricesLoading, livePricesError };
}
