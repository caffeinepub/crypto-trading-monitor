import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, User, TrendingUp, TrendingDown, Trophy, BarChart3 } from 'lucide-react';
import { getAITradeHistory } from '../utils/aiTradeHistoryStorage';
import { getUserTradeHistory } from '../utils/tradeHistoryStorage';
import { calculateAIPerformance, calculateUserPerformance } from '../utils/performanceCalculations';

const MODALITY_LABELS: Record<string, string> = {
  Scalping: 'Scalping',
  DayTrading: 'Day Trading',
  SwingTrading: 'Swing Trading',
  TrendFollowing: 'Trend Following',
};

function WinRateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 60
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : rate >= 40
      ? 'bg-primary/20 text-primary border-primary/30'
      : 'bg-destructive/20 text-destructive border-destructive/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

function PnlDisplay({ pnl }: { pnl: number }) {
  const isPositive = pnl >= 0;
  return (
    <span className={`font-bold text-base ${isPositive ? 'text-emerald-400' : 'text-destructive'}`}>
      {isPositive ? '+' : ''}${pnl.toFixed(2)}
    </span>
  );
}

export function PerformanceComparisonPanel() {
  const aiHistory = useMemo(() => getAITradeHistory(), []);
  const userHistory = useMemo(() => getUserTradeHistory(), []);

  const aiMetrics = useMemo(() => calculateAIPerformance(aiHistory), [aiHistory]);
  const userMetrics = useMemo(() => calculateUserPerformance(userHistory), [userHistory]);

  const hasAIData = aiMetrics.totalTrades > 0;
  const hasUserData = userMetrics.totalTrades > 0;

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Performance Comparison</h3>
          <p className="text-xs text-muted-foreground">AI Trades vs Your Trades — closed positions only</p>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Trades Column */}
        <Card className="border-primary/30 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Trades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {!hasAIData ? (
              <div className="text-center py-6">
                <Bot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No closed AI trades yet. Trades are recorded when TP or SL is hit.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Closed</div>
                    <div className="text-lg font-bold text-foreground">{aiMetrics.totalTrades}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Win Rate</div>
                    <div className="flex justify-center mt-0.5">
                      <WinRateBadge rate={aiMetrics.winRate} />
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Total PnL</div>
                    <div className="mt-0.5">
                      <PnlDisplay pnl={aiMetrics.totalPnlUsd} />
                    </div>
                  </div>
                </div>

                {/* Wins / Losses */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    {aiMetrics.wins} wins
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1 text-destructive">
                    <TrendingDown className="w-3 h-3" />
                    {aiMetrics.totalTrades - aiMetrics.wins} losses
                  </span>
                </div>

                {/* Per-Modality Breakdown */}
                {aiMetrics.modalityBreakdown && aiMetrics.modalityBreakdown.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      By Modality
                    </div>
                    {aiMetrics.modalityBreakdown.map((m) => (
                      <div
                        key={m.modality}
                        className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-muted/20 border border-border/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {MODALITY_LABELS[m.modality] ?? m.modality}
                          </span>
                          <span className="text-xs text-muted-foreground">({m.totalTrades})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <WinRateBadge rate={m.winRate} />
                          <span
                            className={`text-xs font-medium ${
                              m.totalPnl >= 0 ? 'text-emerald-400' : 'text-destructive'
                            }`}
                          >
                            {m.totalPnl >= 0 ? '+' : ''}${m.totalPnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* User Trades Column */}
        <Card className="border-accent/30 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-accent to-primary" />
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Your Trades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            {!hasUserData ? (
              <div className="text-center py-6">
                <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No closed positions yet. Delete a position to record its outcome.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Closed</div>
                    <div className="text-lg font-bold text-foreground">{userMetrics.totalTrades}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Win Rate</div>
                    <div className="flex justify-center mt-0.5">
                      <WinRateBadge rate={userMetrics.winRate} />
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Total PnL</div>
                    <div className="mt-0.5">
                      <PnlDisplay pnl={userMetrics.totalPnlUsd} />
                    </div>
                  </div>
                </div>

                {/* Wins / Losses */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    {userMetrics.wins} wins
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1 text-destructive">
                    <TrendingDown className="w-3 h-3" />
                    {userMetrics.totalTrades - userMetrics.wins} losses
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Head-to-Head comparison when both have data */}
      {hasAIData && hasUserData && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card/80 to-accent/5 backdrop-blur-sm">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Head-to-Head</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-0.5">AI Win Rate</div>
                  <WinRateBadge rate={aiMetrics.winRate} />
                </div>
                <span className="text-muted-foreground font-bold">vs</span>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-0.5">Your Win Rate</div>
                  <WinRateBadge rate={userMetrics.winRate} />
                </div>
              </div>
              <div className="text-right">
                {aiMetrics.winRate > userMetrics.winRate ? (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">AI Leading</Badge>
                ) : aiMetrics.winRate < userMetrics.winRate ? (
                  <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">You're Leading</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Tied</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
