import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, BarChart2, Activity, Clock, TrendingDown, DollarSign } from 'lucide-react';
import { PositionWithPrice } from '../types/position';
import { PortfolioExposure } from '../types/exposure';
import { EnrichedPosition } from '../hooks/usePortfolioExposure';
import { ExposureChart } from './ExposureChart';
import { getTotalCapital } from '../utils/totalCapitalStorage';

interface PortfolioExposureDashboardProps {
  exposure: PortfolioExposure;
  positions: PositionWithPrice[];
  enrichedPositions?: EnrichedPosition[];
  livePricesLoading?: boolean;
  livePricesError?: boolean;
}

export function PortfolioExposureDashboard({
  exposure,
  positions,
  enrichedPositions,
  livePricesLoading,
  livePricesError,
}: PortfolioExposureDashboardProps) {
  const [totalCapital, setTotalCapitalState] = useState<number | null>(() => getTotalCapital());

  useEffect(() => {
    const handler = () => setTotalCapitalState(getTotalCapital());
    window.addEventListener('total-capital-change', handler);
    return () => window.removeEventListener('total-capital-change', handler);
  }, []);

  const deployedPct = useMemo(() => {
    if (!totalCapital || totalCapital <= 0) return null;
    return (exposure.totalCapitalDeployed / totalCapital) * 100;
  }, [exposure.totalCapitalDeployed, totalCapital]);

  const capitalAtRisk = useMemo(() => {
    return positions.reduce((sum, pos) => {
      if (!pos.stopLoss) return sum;
      const slPrice = pos.stopLoss.price;
      const priceDiff = pos.positionType === 'Long'
        ? pos.entryPrice - slPrice
        : slPrice - pos.entryPrice;
      const lossPercent = Math.abs(priceDiff / pos.entryPrice);
      return sum + pos.investmentAmount * pos.leverage * lossPercent;
    }, 0);
  }, [positions]);

  const atRiskPct = useMemo(() => {
    if (!totalCapital || totalCapital <= 0) return null;
    return (capitalAtRisk / totalCapital) * 100;
  }, [capitalAtRisk, totalCapital]);

  // Total live unrealized PnL
  const totalLivePnl = useMemo(() => {
    if (!enrichedPositions || enrichedPositions.length === 0) return null;
    const allHaveLive = enrichedPositions.every((p) => p.livePrice !== null);
    if (!allHaveLive) return null;
    return enrichedPositions.reduce((sum, p) => sum + (p.unrealizedPnlLive ?? 0), 0);
  }, [enrichedPositions]);

  // Total live exposure
  const totalLiveExposure = useMemo(() => {
    if (!enrichedPositions || enrichedPositions.length === 0) return null;
    const allHaveLive = enrichedPositions.every((p) => p.liveExposure !== null);
    if (!allHaveLive) return null;
    return enrichedPositions.reduce((sum, p) => sum + (p.liveExposure ?? 0), 0);
  }, [enrichedPositions]);

  const formatUSD = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const formatUSDPrecise = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  if (positions.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Portfolio Exposure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Add positions to see portfolio exposure analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Portfolio Exposure
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {livePricesLoading && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary animate-pulse">
                Updating...
              </Badge>
            )}
            {livePricesError && (
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Stale data
              </Badge>
            )}
            {deployedPct !== null && deployedPct > 50 && (
              <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                High Exposure
              </Badge>
            )}
            {atRiskPct !== null && atRiskPct > 10 && (
              <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                High Risk
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalCapital === null && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              Configure your total capital in Settings to see exposure percentages.
            </p>
          </div>
        )}

        {/* Capital metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Capital Deployed
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatUSD(exposure.totalCapitalDeployed)}
            </p>
            {deployedPct !== null && (
              <p className={`text-xs ${deployedPct > 50 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {deployedPct.toFixed(1)}% of total
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Leveraged Exposure
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatUSD(exposure.totalLeverageExposure)}
            </p>
            <p className="text-xs text-muted-foreground">
              {exposure.weightedAverageLeverage.toFixed(1)}x avg leverage
            </p>
          </div>

          {/* Live Exposure */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Live Exposure
            </p>
            {totalLiveExposure !== null ? (
              <>
                <p className="text-sm font-bold text-foreground">
                  {formatUSD(totalLiveExposure)}
                </p>
                <p className="text-xs text-chart-1">at current prices</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          {/* Live Unrealized PnL */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {totalLivePnl !== null && totalLivePnl >= 0 ? (
                <TrendingUp className="w-3 h-3 text-chart-1" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              Unrealized PnL
            </p>
            {totalLivePnl !== null ? (
              <>
                <p className={`text-sm font-bold ${totalLivePnl >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                  {totalLivePnl >= 0 ? '+' : ''}{formatUSDPrecise(totalLivePnl)}
                </p>
                <p className="text-xs text-muted-foreground">live prices</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Per-position live metrics */}
        {enrichedPositions && enrichedPositions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Position Metrics</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {enrichedPositions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3 rounded-lg border border-primary/15 bg-primary/5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{pos.symbol}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${pos.positionType === 'Long' ? 'border-chart-1/40 text-chart-1' : 'border-destructive/40 text-destructive'}`}
                      >
                        {pos.positionType}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        {pos.leverage}x
                      </Badge>
                    </div>
                    {pos.priceStale && (
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Stale
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry</span>
                      <span className="font-medium">${pos.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Live Price</span>
                      {pos.livePrice !== null ? (
                        <span className="font-medium text-primary">
                          ${pos.livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Live Exposure</span>
                      {pos.liveExposure !== null ? (
                        <span className="font-medium">{formatUSD(pos.liveExposure)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unreal. PnL</span>
                      {pos.unrealizedPnlLive !== null ? (
                        <span className={`font-bold ${pos.unrealizedPnlLive >= 0 ? 'text-chart-1' : 'text-destructive'}`}>
                          {pos.unrealizedPnlLive >= 0 ? '+' : ''}{formatUSDPrecise(pos.unrealizedPnlLive)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Liq. Price</span>
                      {pos.liquidationPrice !== null ? (
                        <span className="font-medium text-destructive/80">
                          ${pos.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dist. to Liq.</span>
                      {pos.distanceToLiquidation !== null ? (
                        <span className={`font-bold ${
                          pos.distanceToLiquidation > 20 ? 'text-chart-1' :
                          pos.distanceToLiquidation > 10 ? 'text-amber-400' : 'text-destructive'
                        }`}>
                          {pos.distanceToLiquidation.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exposure Chart — pass individual props that ExposureChart expects */}
        <ExposureChart
          exposureByAsset={exposure.exposureByAsset}
          longShortBalance={exposure.longShortBalance}
          totalCapital={exposure.totalCapitalDeployed}
        />

        {/* Correlation Risks */}
        {exposure.correlationRisks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correlation Risks</p>
            {exposure.correlationRisks.map((risk, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg border text-xs ${
                  risk.riskLevel === 'high'
                    ? 'bg-destructive/10 border-destructive/30 text-destructive'
                    : risk.riskLevel === 'medium'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-primary/5 border-primary/20 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-medium capitalize">{risk.riskLevel} correlation</span>
                </div>
                <p>{risk.description}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioExposureDashboard;
