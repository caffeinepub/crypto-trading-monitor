import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAITradeGeneration } from '../hooks/useAITradeGeneration';
import { useAITradeMonitoring } from '../hooks/useAITradeMonitoring';
import { useAITradeStorage } from '../hooks/useAITradeStorage';
import { AITradeCard } from './AITradeCard';
import { AIDailyTradesSummary } from './AIDailyTradesSummary';
import { useQueryClient } from '@tanstack/react-query';

export function AIDailyTradesSection() {
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();
  const { clearTrades } = useAITradeStorage();

  // useAITradeGeneration now returns a UseQueryResult<AITrade[]>
  const {
    data: trades,
    isLoading: isGenerating,
    error: generationError,
    isFetching: isRefetching,
  } = useAITradeGeneration();

  const monitoringQuery = useAITradeMonitoring(trades);

  // useAITradeMonitoring returns a UseQueryResult — extract fields safely
  const tradesWithPrices = monitoringQuery.data;
  const dataUpdatedAt = monitoringQuery.dataUpdatedAt;
  const isPriceFetching = monitoringQuery.isFetching;

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const handleForceRefresh = () => {
    clearTrades();
    queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
  };

  return (
    <section className="w-full">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm hover:bg-card transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-foreground">AI Daily Trades</div>
            <div className="text-xs text-muted-foreground">
              One trade per modality · Binance USDT-M Perpetual · Real data
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPriceFetching && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Loading State */}
          {isGenerating && (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/20 bg-card/60 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    AI is analyzing Binance markets and generating today's trades…
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {generationError && !isGenerating && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <span className="text-destructive text-lg">⚠️</span>
                <div>
                  <div className="text-sm font-medium text-destructive mb-1">
                    Failed to generate AI trades
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {generationError instanceof Error
                      ? generationError.message
                      : 'Unable to connect to Binance API. Please check your connection and try again.'}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleForceRefresh}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Trades Display */}
          {!isGenerating && !generationError && tradesWithPrices && tradesWithPrices.length > 0 && (
            <>
              <AIDailyTradesSummary trades={tradesWithPrices} lastUpdated={lastUpdated} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tradesWithPrices.map((trade) => (
                  <AITradeCard key={trade.id} trade={trade} />
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleForceRefresh}
                  disabled={isRefetching}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
                  Regenerate today's trades
                </Button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!isGenerating && !generationError && (!tradesWithPrices || tradesWithPrices.length === 0) && (
            <div className="rounded-xl border border-border/50 bg-card/60 p-6 text-center">
              <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">No trades available yet.</div>
              <Button size="sm" variant="outline" onClick={handleForceRefresh} className="mt-3">
                <RefreshCw className="w-3 h-3 mr-1.5" />
                Generate Trades
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
