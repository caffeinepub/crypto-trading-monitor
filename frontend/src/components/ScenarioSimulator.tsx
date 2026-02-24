import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PositionWithPrice } from '../types/position';
import { simulateScenario, SCENARIO_PRESETS } from '../utils/scenarioSimulator';
import { ScenarioResult } from '../types/scenario';
import { getTotalCapital } from '../utils/totalCapitalStorage';
import { fetchCurrentPrices, fetchKlines } from '../services/binanceApi';
import { calculateATR } from '../utils/technicalAnalysis';

interface ScenarioSimulatorProps {
  positions: PositionWithPrice[];
}

interface AtrPreset {
  name: string;
  percentageChange: number;
  direction: 'up' | 'down';
}

export function ScenarioSimulator({ positions }: ScenarioSimulatorProps) {
  const [percentageChange, setPercentageChange] = useState<number>(0);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [totalCapital, setTotalCapital] = useState<number | null>(getTotalCapital());

  useEffect(() => {
    setTotalCapital(getTotalCapital());
  }, [positions]);

  const symbols = useMemo(() => [...new Set(positions.map((p) => p.symbol))], [positions]);

  // Fetch live prices for all position symbols
  const {
    data: livePricesData,
    isLoading: isPricesLoading,
    isError: isPricesError,
    refetch: refetchPrices,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['scenario-live-prices', symbols],
    queryFn: () => fetchCurrentPrices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  // Fetch klines for ATR calculation (use first symbol as representative)
  const primarySymbol = symbols[0] ?? 'BTCUSDT';
  const {
    data: klinesData,
    isLoading: isKlinesLoading,
  } = useQuery({
    queryKey: ['scenario-klines-atr', primarySymbol],
    queryFn: () => fetchKlines(primarySymbol, '1h', 100),
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

  // Compute ATR-based presets
  const atrPresets: AtrPreset[] = useMemo(() => {
    if (!klinesData || klinesData.length < 15) return [];
    const closes = klinesData.map((k) => k.close);
    const atr1d = calculateATR(closes, 24); // 24 hourly candles ≈ 1 day
    const atr3d = calculateATR(closes, 72); // 72 hourly candles ≈ 3 days

    const refPrice = closes[closes.length - 1];
    if (!refPrice || refPrice === 0) return [];

    const atr1dPct = (atr1d / refPrice) * 100;
    const atr3dPct = (atr3d / refPrice) * 100;

    if (atr1dPct === 0 && atr3dPct === 0) return [];

    return [
      { name: `1-day ATR ↑ (+${atr1dPct.toFixed(1)}%)`, percentageChange: atr1dPct, direction: 'up' },
      { name: `1-day ATR ↓ (-${atr1dPct.toFixed(1)}%)`, percentageChange: -atr1dPct, direction: 'down' },
      { name: `3-day ATR ↑ (+${atr3dPct.toFixed(1)}%)`, percentageChange: atr3dPct, direction: 'up' },
      { name: `3-day ATR ↓ (-${atr3dPct.toFixed(1)}%)`, percentageChange: -atr3dPct, direction: 'down' },
    ];
  }, [klinesData]);

  // Build positions enriched with live prices for simulation
  const enrichedPositions = useMemo((): PositionWithPrice[] => {
    return positions.map((pos) => {
      const livePrice = livePriceMap.get(pos.symbol);
      if (livePrice !== undefined) {
        return { ...pos, currentPrice: livePrice };
      }
      return pos;
    });
  }, [positions, livePriceMap]);

  const usingLivePrices = !isPricesError && livePricesData && livePricesData.length > 0;

  const runSimulation = (change: number) => {
    setPercentageChange(change);
    if (enrichedPositions.length > 0) {
      const simResult = simulateScenario(enrichedPositions, change);
      setResult(simResult);
    }
  };

  const handleSliderChange = (value: number[]) => {
    runSimulation(value[0]);
  };

  const handlePresetClick = (change: number) => {
    runSimulation(change);
  };

  const hasLiquidationRisk = result?.positionOutcomes.some((o) => o.liquidationRisk) || false;
  const impactPercent = totalCapital && result ? (result.totalImpactUSD / totalCapital) * 100 : null;
  const highLossWarning = impactPercent !== null && impactPercent < -20;

  // Show baseline prices in results
  const getBaselinePrice = (symbol: string) => {
    const live = livePriceMap.get(symbol);
    if (live !== undefined) return { price: live, isLive: true };
    const pos = positions.find((p) => p.symbol === symbol);
    return pos ? { price: pos.entryPrice, isLive: false } : null;
  };

  return (
    <Card className="border-primary/30 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Scenario Simulator
          </CardTitle>
          <div className="flex items-center gap-2">
            {isPricesError ? (
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </Badge>
            ) : usingLivePrices ? (
              <Badge variant="outline" className="text-xs border-chart-1/40 text-chart-1 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Live
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => refetchPrices()}
              disabled={isPricesLoading}
            >
              <RefreshCw className={`w-3 h-3 ${isPricesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fallback warning */}
        {isPricesError && positions.length > 0 && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-6 text-xs">
              Using entry price as fallback — live price fetch failed.
            </AlertDescription>
          </Alert>
        )}

        {/* Preset Scenarios */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Quick Scenarios</p>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIO_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset.percentageChange)}
                className="justify-start"
              >
                {preset.percentageChange > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-2 text-chart-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-2 text-destructive" />
                )}
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* ATR-based presets */}
        {(atrPresets.length > 0 || isKlinesLoading) && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              ATR Volatility Presets
              {isKlinesLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
              )}
              {!isKlinesLoading && atrPresets.length > 0 && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  {primarySymbol}
                </Badge>
              )}
            </p>
            {atrPresets.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {atrPresets.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset.percentageChange)}
                    className="justify-start text-xs"
                  >
                    {preset.direction === 'up' ? (
                      <TrendingUp className="w-3 h-3 mr-2 text-chart-1 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-2 text-destructive shrink-0" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Custom Price Change</p>
            <Badge
              variant={percentageChange >= 0 ? 'default' : 'destructive'}
              className={percentageChange >= 0 ? 'bg-chart-1 hover:bg-chart-1/90' : ''}
            >
              {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
            </Badge>
          </div>
          <Slider
            value={[percentageChange]}
            onValueChange={handleSliderChange}
            min={-50}
            max={50}
            step={0.5}
            className="py-2"
          />
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2">
            {/* Total Impact */}
            <div className={`p-4 rounded-lg border ${
              result.totalImpactUSD >= 0
                ? 'bg-chart-1/10 border-chart-1/30'
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <p className="text-sm text-muted-foreground mb-2">Total Portfolio Impact</p>
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold ${
                  result.totalImpactUSD >= 0 ? 'text-chart-1' : 'text-destructive'
                }`}>
                  {result.totalImpactUSD >= 0 ? '+' : ''}${result.totalImpactUSD.toFixed(2)}
                </span>
                <Badge
                  variant={result.totalImpactUSD >= 0 ? 'default' : 'destructive'}
                  className={`text-lg ${result.totalImpactUSD >= 0 ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
                >
                  {result.totalImpactPercent >= 0 ? '+' : ''}{result.totalImpactPercent.toFixed(2)}%
                </Badge>
              </div>
              {impactPercent !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  {impactPercent >= 0 ? '+' : ''}{impactPercent.toFixed(2)}% of total capital
                </p>
              )}
            </div>

            {/* High Loss Warning */}
            {highLossWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  ⚠️ Critical Warning: This scenario would result in a loss exceeding 20% of your total capital!
                </AlertDescription>
              </Alert>
            )}

            {/* Liquidation Warning */}
            {hasLiquidationRisk && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  ⚠️ Warning: Some positions face liquidation risk in this scenario!
                </AlertDescription>
              </Alert>
            )}

            {/* Individual Position Outcomes */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Position Outcomes</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.positionOutcomes.map((outcome) => {
                  const baseline = getBaselinePrice(outcome.symbol);
                  return (
                    <div
                      key={outcome.positionId}
                      className={`p-3 rounded-lg border ${
                        outcome.liquidationRisk
                          ? 'bg-destructive/20 border-destructive'
                          : outcome.projectedPnL >= 0
                          ? 'bg-chart-1/10 border-chart-1/30'
                          : 'bg-destructive/10 border-destructive/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{outcome.symbol}</span>
                        <div className="flex items-center gap-2">
                          {outcome.tpHit && (
                            <Badge variant="default" className="text-xs bg-chart-1 hover:bg-chart-1/90">
                              TP Hit
                            </Badge>
                          )}
                          {outcome.slHit && (
                            <Badge variant="destructive" className="text-xs">
                              SL Hit
                            </Badge>
                          )}
                          {outcome.liquidationRisk && (
                            <Badge variant="destructive" className="text-xs">
                              Liquidation Risk
                            </Badge>
                          )}
                        </div>
                      </div>
                      {baseline && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs text-muted-foreground">Baseline:</span>
                          <span className="text-xs font-medium text-primary">
                            ${baseline.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                          </span>
                          {baseline.isLive ? (
                            <Badge variant="outline" className="text-xs h-4 px-1 border-chart-1/40 text-chart-1">Live</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs h-4 px-1 border-amber-500/30 text-amber-400">Entry</Badge>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          → ${outcome.simulatedPrice.toFixed(4)}
                        </span>
                        <span className={`font-bold ${
                          outcome.projectedPnL >= 0 ? 'text-chart-1' : 'text-destructive'
                        }`}>
                          {outcome.projectedPnL >= 0 ? '+' : ''}${outcome.projectedPnL.toFixed(2)} ({outcome.projectedPnLPercent >= 0 ? '+' : ''}{outcome.projectedPnLPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
