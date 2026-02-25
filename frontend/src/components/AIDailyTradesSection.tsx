import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAITradeStorage } from '../hooks/useAITradeStorage';
import { useAITradeGeneration } from '../hooks/useAITradeGeneration';
import { useAITradeMonitoring } from '../hooks/useAITradeMonitoring';
import { fetchCurrentPrices } from '../services/binanceApi';
import { calculatePnl } from '../utils/pnlCalculations';
import AITradeCard from './AITradeCard';
import { AIDailyTradesSummary } from './AIDailyTradesSummary';
import type { AITrade, AITradeWithPrice } from '../types/aiTrade';

function toTradeWithPrice(t: AITrade, priceMap: Record<string, number>): AITradeWithPrice {
  const a = t as any;

  // Prefer freshly-fetched price from priceMap, then runtime-attached price, then 0
  const livePrice = priceMap[t.symbol];
  const runtimePrice: number = a.currentPrice ?? 0;
  const currentPrice = (livePrice && livePrice > 0) ? livePrice : runtimePrice;

  // Only compute PnL when we have a real live price
  let pnlUsd: number | null = null;
  let pnlPercent: number | null = null;

  if (currentPrice > 0) {
    const calc = calculatePnl(
      t.entryPrice,
      currentPrice,
      t.investmentAmount,
      t.leverage,
      t.positionType
    );
    pnlUsd = calc.pnlUsd;
    pnlPercent = calc.pnlPercent;
  }

  // Safely cast reversalAction to the required union type
  const rawAction = a.reversalAction ?? t.reversalAction;
  const validActions = ['close', 'reverse', 'tighten_sl', 'none'] as const;
  const reversalAction: AITradeWithPrice['reversalAction'] =
    validActions.includes(rawAction) ? rawAction : 'none';

  return {
    ...t,
    currentPrice,
    // Use null-coalesced values — keep 0 only when we have a valid price that yields 0 PnL
    pnlUsd: pnlUsd ?? 0,
    pnlPercent: pnlPercent ?? 0,
    tp1Executed: a.tp1Executed ?? false,
    tp2Executed: a.tp2Executed ?? false,
    tp3Executed: a.tp3Executed ?? false,
    effectiveSL: a.effectiveSL ?? t.stopLoss,
    riskManagementStep: a.riskManagementStep ?? 'initial',
    reversalDetected: a.reversalDetected ?? false,
    reversalConfidence: a.reversalConfidence ?? 0,
    reversalReason: a.reversalReason ?? '',
    reversalAction,
  };
}

export function AIDailyTradesSection() {
  const { getTrades } = useAITradeStorage();
  const { isFetching, refetch } = useAITradeGeneration();

  // Start the monitoring loop (updates localStorage + dispatches events)
  useAITradeMonitoring();

  // priceMap holds the latest fetched prices per symbol
  const priceMapRef = useRef<Record<string, number>>({});
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [tradesWithPrices, setTradesWithPrices] = useState<AITradeWithPrice[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingPricesRef = useRef(false);

  // Rebuild tradesWithPrices from storage + given priceMap
  const rebuildTrades = useCallback(
    (currentPriceMap: Record<string, number>) => {
      const raw = getTrades();
      const enriched = raw.map((t) => toTradeWithPrice(t, currentPriceMap));
      setTradesWithPrices(enriched);
    },
    [getTrades]
  );

  // Fetch live prices for all active trades using bulk endpoint
  const fetchPrices = useCallback(async () => {
    if (isFetchingPricesRef.current) return;
    isFetchingPricesRef.current = true;

    try {
      const trades = getTrades();
      if (!trades || trades.length === 0) {
        setPricesLoading(false);
        return;
      }

      const symbols = [...new Set(trades.map((t) => t.symbol))];

      try {
        // Use bulk fetch for efficiency
        const priceList = await fetchCurrentPrices(symbols);
        const newPriceMap: Record<string, number> = { ...priceMapRef.current };

        for (const item of priceList) {
          const price = parseFloat(item.price);
          if (isFinite(price) && price > 0) {
            newPriceMap[item.symbol] = price;
          }
        }

        priceMapRef.current = newPriceMap;

        // Rebuild trades with the new prices BEFORE updating state
        // This ensures pricesLoading=false is set only after trades are enriched
        const raw = getTrades();
        const enriched = raw.map((t) => toTradeWithPrice(t, newPriceMap));
        setTradesWithPrices(enriched);
        setPriceMap(newPriceMap);
        setLastUpdated(new Date());
      } catch {
        // On error, try individual fetches as fallback
        const newPriceMap: Record<string, number> = { ...priceMapRef.current };
        await Promise.allSettled(
          symbols.map(async (symbol) => {
            try {
              const res = await fetch(
                `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`
              );
              if (res.ok) {
                const data = await res.json();
                const price = parseFloat(data.price);
                if (isFinite(price) && price > 0) {
                  newPriceMap[symbol] = price;
                }
              }
            } catch {
              // keep existing price
            }
          })
        );

        priceMapRef.current = newPriceMap;
        const raw = getTrades();
        const enriched = raw.map((t) => toTradeWithPrice(t, newPriceMap));
        setTradesWithPrices(enriched);
        setPriceMap(newPriceMap);
        setLastUpdated(new Date());
      }
    } finally {
      setPricesLoading(false);
      isFetchingPricesRef.current = false;
    }
  }, [getTrades]);

  // Initial load — show trades immediately from storage, then fetch prices
  useEffect(() => {
    rebuildTrades({});
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll prices every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Listen for trade changes (TP/SL hits, new generation, monitoring updates)
  useEffect(() => {
    const handleTradesChanged = () => {
      // Rebuild with current priceMap first, then re-fetch prices
      rebuildTrades(priceMapRef.current);
      fetchPrices();
    };

    window.addEventListener('ai-trades-changed', handleTradesChanged);
    window.addEventListener('ai-trades-price-update', handleTradesChanged);

    return () => {
      window.removeEventListener('ai-trades-changed', handleTradesChanged);
      window.removeEventListener('ai-trades-price-update', handleTradesChanged);
    };
  }, [rebuildTrades, fetchPrices]);

  const handleRefresh = () => {
    refetch();
  };

  if (isFetching && tradesWithPrices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Daily Trades
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          AI Daily Trades
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {tradesWithPrices.length > 0 && (
        <AIDailyTradesSummary
          trades={tradesWithPrices}
          lastUpdated={lastUpdated}
          pricesLoading={pricesLoading}
        />
      )}

      {tradesWithPrices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum trade ativo no momento.</p>
          <p className="text-xs mt-1">Clique em Atualizar para gerar novos trades.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tradesWithPrices.map((trade) => {
            // A trade's price is loading if: global prices are still loading AND
            // we don't have a valid price for this symbol yet
            const symbolHasPrice =
              priceMapRef.current[trade.symbol] != null &&
              priceMapRef.current[trade.symbol] > 0;
            const tradepriceLoading = pricesLoading && !symbolHasPrice;

            return (
              <AITradeCard
                key={trade.id}
                trade={trade}
                priceLoading={tradepriceLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AIDailyTradesSection;
