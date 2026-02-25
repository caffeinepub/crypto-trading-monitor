import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AITradeCard } from '@/components/AITradeCard';
import { AIDailyTradesSummary } from '@/components/AIDailyTradesSummary';
import { useAITradeGeneration } from '@/hooks/useAITradeGeneration';
import { useAITradeMonitoring } from '@/hooks/useAITradeMonitoring';
import { useAITradeStorage } from '@/hooks/useAITradeStorage';
import { AITrade, AITradeWithPrice } from '@/types/aiTrade';

function toTradeWithPrice(t: AITrade): AITradeWithPrice {
  const a = t as any;
  return {
    ...t,
    currentPrice: a.currentPrice ?? t.entryPrice,
    pnlUsd: a.pnlUsd ?? 0,
    pnlPercent: a.pnlPercent ?? 0,
    tp1Executed: a.tp1Executed ?? false,
    tp2Executed: a.tp2Executed ?? false,
    tp3Executed: a.tp3Executed ?? false,
    effectiveSL: a.effectiveSL ?? t.stopLoss,
    riskManagementStep: a.riskManagementStep ?? 'initial',
    reversalDetected: a.reversalDetected ?? false,
    reversalConfidence: a.reversalConfidence ?? 0,
    reversalReason: a.reversalReason ?? '',
    reversalAction: a.reversalAction ?? 'none',
  };
}

export function AIDailyTradesSection() {
  const {
    data: trades,
    isLoading,
    isFetching,
    refetch,
  } = useAITradeGeneration();

  const { getTrades } = useAITradeStorage();

  const [tradesWithPrices, setTradesWithPrices] = useState<AITradeWithPrice[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Run monitoring hook (updates localStorage and dispatches events)
  useAITradeMonitoring(trades);

  // Listen for trade updates from monitoring
  useEffect(() => {
    const handleTradesChanged = () => {
      const updated = getTrades();
      setTradesWithPrices(updated.map(toTradeWithPrice));
      setLastUpdated(new Date());
    };

    window.addEventListener('ai-trades-changed', handleTradesChanged);
    return () => window.removeEventListener('ai-trades-changed', handleTradesChanged);
  }, [getTrades]);

  // Initialize tradesWithPrices when trades first load
  useEffect(() => {
    if (trades && trades.length > 0) {
      setTradesWithPrices(trades.map(toTradeWithPrice));
      setLastUpdated(new Date());
    }
  }, [trades]);

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Daily Trades
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-64 rounded-lg bg-muted/30 animate-pulse"
            />
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
          {tradesWithPrices.map(trade => (
            <AITradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AIDailyTradesSection;
