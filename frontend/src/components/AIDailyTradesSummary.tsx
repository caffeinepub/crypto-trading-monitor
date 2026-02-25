import React, { useMemo } from 'react';
import { AITradeWithPrice } from '../types/aiTrade';
import { TrendingUp, TrendingDown, Activity, ShieldCheck, Loader2 } from 'lucide-react';
import { getAITradeHistory } from '../utils/aiTradeHistoryStorage';

interface AIDailyTradesSummaryProps {
  trades: AITradeWithPrice[];
  lastUpdated: Date | null;
  pricesLoading?: boolean;
}

function getCurrentUTCDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function AIDailyTradesSummary({ trades, lastUpdated, pricesLoading = false }: AIDailyTradesSummaryProps) {
  // Only include trades that have a valid loaded price for PnL aggregation
  const tradesWithValidPrice = trades.filter(
    (t) => isFinite(t.currentPrice) && t.currentPrice > 0
  );

  const totalPnlUsd = tradesWithValidPrice.reduce((sum, t) => sum + t.pnlUsd, 0);
  const totalInvestment = tradesWithValidPrice.reduce((sum, t) => sum + t.investmentAmount, 0);
  const totalPnlPercent = totalInvestment > 0 ? (totalPnlUsd / totalInvestment) * 100 : 0;
  const winningTrades = tradesWithValidPrice.filter((t) => t.pnlUsd >= 0).length;
  const losingTrades = tradesWithValidPrice.filter((t) => t.pnlUsd < 0).length;
  const isPositive = totalPnlUsd >= 0;

  // Are all trades still loading prices?
  const allPricesLoading = pricesLoading && tradesWithValidPrice.length === 0 && trades.length > 0;

  // Count reversal guard activations today
  const reversalGuardCount = useMemo(() => {
    const today = getCurrentUTCDate();
    const history = getAITradeHistory();
    return history.filter((record) => {
      const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
      if (recordDate !== today) return false;
      return (
        record.outcomeNote?.includes('Closed by reversal detection') ||
        record.outcomeNote?.includes('direction reversed')
      );
    }).length;
  }, [lastUpdated]);

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--';

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 mb-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Portfolio PnL */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              AI Portfolio PnL Today
            </span>
          </div>
          {allPricesLoading ? (
            <div className="flex items-center gap-2 h-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Carregando preços...</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold ${isPositive ? 'text-emerald-400' : 'text-destructive'}`}
              >
                {isPositive ? '+' : ''}
                {totalPnlUsd.toFixed(2)} USDT
              </span>
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  isPositive ? 'text-emerald-400' : 'text-destructive'
                }`}
              >
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? '+' : ''}
                {totalPnlPercent.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400">{winningTrades}</div>
            <div className="text-xs text-muted-foreground">Winning</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-destructive">{losingTrades}</div>
            <div className="text-xs text-muted-foreground">Losing</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{trades.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          {/* Reversal Guard count */}
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-lg font-bold text-amber-400">{reversalGuardCount}</div>
            </div>
            <div className="text-xs text-muted-foreground">Rev. Guard</div>
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div className="relative mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Binance USDT-M Futures Perpetual • Simulated Demo Trades
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · {formattedTime}
        </span>
      </div>
    </div>
  );
}
