import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PositionWithPrice } from '../types/position';
import { fetchCurrentPrices, fetchLeverageBracket, LeverageBracket } from '../services/binanceApi';

interface LiveRiskMetricsCardProps {
  positions: PositionWithPrice[];
}

interface PositionRiskMetric {
  id: string;
  symbol: string;
  positionType: 'Long' | 'Short';
  leverage: number;
  entryPrice: number;
  livePrice: number | null;
  liquidationPrice: number | null;
  distanceToLiquidation: number | null;
  maintMarginRatio: number;
  riskLevel: 'safe' | 'warning' | 'danger' | 'unknown';
}

function getRiskLevel(distance: number | null): 'safe' | 'warning' | 'danger' | 'unknown' {
  if (distance === null) return 'unknown';
  if (distance > 20) return 'safe';
  if (distance >= 10) return 'warning';
  return 'danger';
}

function computeLiquidationPrice(
  entryPrice: number,
  leverage: number,
  positionType: 'Long' | 'Short',
  maintMarginRatio: number
): number {
  if (positionType === 'Long') {
    return entryPrice * (1 - 1 / leverage + maintMarginRatio);
  } else {
    return entryPrice * (1 + 1 / leverage - maintMarginRatio);
  }
}

function findMaintMarginRatio(brackets: LeverageBracket[], leverage: number): number {
  if (!brackets || brackets.length === 0) return 0.004;
  const sorted = [...brackets].sort((a, b) => b.initialLeverage - a.initialLeverage);
  const bracket = sorted.find((b) => leverage <= b.initialLeverage) ?? sorted[sorted.length - 1];
  return bracket?.maintMarginRatio ?? 0.004;
}

export function LiveRiskMetricsCard({ positions }: LiveRiskMetricsCardProps) {
  const symbols = useMemo(() => [...new Set(positions.map((p) => p.symbol))], [positions]);

  // Fetch live prices for all symbols
  const {
    data: livePricesData,
    isLoading: isPricesLoading,
    isError: isPricesError,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ['live-risk-card-prices', symbols],
    queryFn: () => fetchCurrentPrices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  // Fetch leverage brackets for all unique symbols
  const {
    data: bracketsMap,
    isLoading: isBracketsLoading,
    isError: isBracketsError,
  } = useQuery({
    queryKey: ['live-risk-card-brackets', symbols],
    queryFn: async () => {
      const results = await Promise.allSettled(
        symbols.map(async (sym) => {
          const data = await fetchLeverageBracket(sym);
          return { symbol: sym, brackets: data[0]?.brackets ?? [] };
        })
      );
      const map = new Map<string, LeverageBracket[]>();
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          map.set(r.value.symbol, r.value.brackets);
        }
      });
      return map;
    },
    enabled: symbols.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const livePriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (livePricesData) {
      livePricesData.forEach((p) => map.set(p.symbol, parseFloat(p.price)));
    }
    return map;
  }, [livePricesData]);

  const positionMetrics: PositionRiskMetric[] = useMemo(() => {
    return positions.map((pos) => {
      const livePrice = livePriceMap.get(pos.symbol) ?? null;
      const brackets = bracketsMap?.get(pos.symbol) ?? [];
      const maintMarginRatio = findMaintMarginRatio(brackets, pos.leverage);

      let liquidationPrice: number | null = null;
      let distanceToLiquidation: number | null = null;

      if (livePrice !== null) {
        liquidationPrice = computeLiquidationPrice(pos.entryPrice, pos.leverage, pos.positionType, maintMarginRatio);

        if (pos.positionType === 'Long') {
          distanceToLiquidation = ((livePrice - liquidationPrice) / livePrice) * 100;
        } else {
          distanceToLiquidation = ((liquidationPrice - livePrice) / livePrice) * 100;
        }
      }

      return {
        id: pos.id,
        symbol: pos.symbol,
        positionType: pos.positionType,
        leverage: pos.leverage,
        entryPrice: pos.entryPrice,
        livePrice,
        liquidationPrice,
        distanceToLiquidation,
        maintMarginRatio,
        riskLevel: getRiskLevel(distanceToLiquidation),
      };
    });
  }, [positions, livePriceMap, bracketsMap]);

  // Portfolio summary counts
  const riskSummary = useMemo(() => {
    const safe = positionMetrics.filter((m) => m.riskLevel === 'safe').length;
    const warning = positionMetrics.filter((m) => m.riskLevel === 'warning').length;
    const danger = positionMetrics.filter((m) => m.riskLevel === 'danger').length;
    const unknown = positionMetrics.filter((m) => m.riskLevel === 'unknown').length;
    return { safe, warning, danger, unknown };
  }, [positionMetrics]);

  const isLoading = isPricesLoading || isBracketsLoading;
  const hasError = isPricesError && isBracketsError;

  if (positions.length === 0) return null;

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="w-5 h-5 text-primary" />
            Live Risk Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
            {isPricesError && (
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => refetchAll()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data unavailable state */}
        {hasError && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <WifiOff className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Data unavailable — unable to reach Binance API.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchAll()}>
              Retry
            </Button>
          </div>
        )}

        {/* Portfolio summary row */}
        {!hasError && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Portfolio Risk:</span>
            {riskSummary.safe > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-chart-1" />
                <span className="text-xs font-medium text-chart-1">{riskSummary.safe} Safe</span>
              </div>
            )}
            {riskSummary.warning > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">{riskSummary.warning} Warning</span>
              </div>
            )}
            {riskSummary.danger > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">{riskSummary.danger} Danger</span>
              </div>
            )}
            {riskSummary.unknown > 0 && (
              <span className="text-xs text-muted-foreground">{riskSummary.unknown} loading...</span>
            )}
          </div>
        )}

        {/* Per-position risk rows */}
        {!hasError && (
          <div className="space-y-2">
            {isLoading && positionMetrics.every((m) => m.livePrice === null) ? (
              // Skeleton loading state
              Array.from({ length: positions.length }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))
            ) : (
              positionMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className={`p-3 rounded-lg border space-y-2 ${
                    metric.riskLevel === 'danger'
                      ? 'bg-destructive/10 border-destructive/30'
                      : metric.riskLevel === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : metric.riskLevel === 'safe'
                      ? 'bg-chart-1/5 border-chart-1/20'
                      : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{metric.symbol}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${metric.positionType === 'Long' ? 'border-chart-1/40 text-chart-1' : 'border-destructive/40 text-destructive'}`}
                      >
                        {metric.positionType}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        {metric.leverage}x
                      </Badge>
                    </div>
                    {metric.riskLevel === 'safe' && (
                      <Badge className="text-xs bg-chart-1/20 text-chart-1 border-chart-1/30 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Safe
                      </Badge>
                    )}
                    {metric.riskLevel === 'warning' && (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Warning
                      </Badge>
                    )}
                    {metric.riskLevel === 'danger' && (
                      <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Danger
                      </Badge>
                    )}
                    {metric.riskLevel === 'unknown' && (
                      <Badge variant="outline" className="text-xs text-muted-foreground animate-pulse">
                        Loading...
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-muted-foreground">Live Price</span>
                      {metric.livePrice !== null ? (
                        <span className="font-medium text-primary">
                          ${metric.livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-muted-foreground">Entry Price</span>
                      <span className="font-medium">
                        ${metric.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                      </span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-muted-foreground">Liq. Price</span>
                      {metric.liquidationPrice !== null ? (
                        <span className="font-medium text-destructive/80">
                          ${metric.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-muted-foreground">Dist. to Liq.</span>
                      {metric.distanceToLiquidation !== null ? (
                        <span className={`font-bold ${
                          metric.riskLevel === 'safe' ? 'text-chart-1' :
                          metric.riskLevel === 'warning' ? 'text-amber-400' : 'text-destructive'
                        }`}>
                          {metric.distanceToLiquidation.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {/* Maint margin info */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Maint. margin: {(metric.maintMarginRatio * 100).toFixed(2)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
