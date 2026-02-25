import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  LayoutGrid,
  ChevronDown,
  InboxIcon,
} from 'lucide-react';
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

// Sentinel value meaning "simulate all positions"
const ALL_POSITIONS_VALUE = '__ALL__';

export function ScenarioSimulator({ positions }: ScenarioSimulatorProps) {
  const [percentageChange, setPercentageChange] = useState<number>(0);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [totalCapital, setTotalCapital] = useState<number | null>(getTotalCapital());
  // selectedSymbol: a specific symbol string OR ALL_POSITIONS_VALUE
  const [selectedSymbol, setSelectedSymbol] = useState<string>(ALL_POSITIONS_VALUE);

  // Refresh total capital when positions change
  useEffect(() => {
    setTotalCapital(getTotalCapital());
  }, [positions]);

  // Auto-select first position when positions change
  useEffect(() => {
    if (positions.length === 0) {
      setSelectedSymbol(ALL_POSITIONS_VALUE);
      setResult(null);
      return;
    }
    // If current selection is no longer valid, reset to first position
    if (
      selectedSymbol !== ALL_POSITIONS_VALUE &&
      !positions.some((p) => p.symbol === selectedSymbol)
    ) {
      setSelectedSymbol(positions[0].symbol);
      setResult(null);
    }
    // If only one position, auto-select it
    if (positions.length === 1) {
      setSelectedSymbol(positions[0].symbol);
    }
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique symbols from all positions
  const allSymbols = useMemo(() => [...new Set(positions.map((p) => p.symbol))], [positions]);

  // Positions to simulate (filtered by selection)
  const simulationPositions = useMemo((): PositionWithPrice[] => {
    if (selectedSymbol === ALL_POSITIONS_VALUE) return positions;
    return positions.filter((p) => p.symbol === selectedSymbol);
  }, [positions, selectedSymbol]);

  // Symbols needed for live price fetch
  const symbols = useMemo(
    () => [...new Set(simulationPositions.map((p) => p.symbol))],
    [simulationPositions]
  );

  // Fetch live prices for selected symbols
  const {
    data: livePricesData,
    isLoading: isPricesLoading,
    isError: isPricesError,
    refetch: refetchPrices,
  } = useQuery({
    queryKey: ['scenario-live-prices', symbols],
    queryFn: () => fetchCurrentPrices(symbols),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  // Primary symbol for ATR calculation — use selected symbol if specific, else first
  const primarySymbol =
    selectedSymbol !== ALL_POSITIONS_VALUE ? selectedSymbol : (allSymbols[0] ?? 'BTCUSDT');

  // Fetch klines for ATR calculation
  const { data: klinesData, isLoading: isKlinesLoading } = useQuery({
    queryKey: ['scenario-klines-atr', primarySymbol],
    queryFn: () => fetchKlines(primarySymbol, '1h', 100),
    enabled: positions.length > 0,
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
    const atr1d = calculateATR(closes, 24);
    const atr3d = calculateATR(closes, 72);

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
    return simulationPositions.map((pos) => {
      const livePrice = livePriceMap.get(pos.symbol);
      if (livePrice !== undefined) {
        return { ...pos, currentPrice: livePrice };
      }
      return pos;
    });
  }, [simulationPositions, livePriceMap]);

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

  const handleSymbolChange = (value: string) => {
    setSelectedSymbol(value);
    setResult(null);
    setPercentageChange(0);
  };

  const hasLiquidationRisk = result?.positionOutcomes.some((o) => o.liquidationRisk) || false;
  const impactPercent = totalCapital && result ? (result.totalImpactUSD / totalCapital) * 100 : null;
  const highLossWarning = impactPercent !== null && impactPercent < -20;

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
              disabled={isPricesLoading || positions.length === 0}
            >
              <RefreshCw className={`w-3 h-3 ${isPricesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Empty state */}
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <InboxIcon className="w-12 h-12 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              No positions found — import positions from the Dashboard tab.
            </p>
          </div>
        ) : (
          <>
            {/* Asset / Position Selector */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                Simulate
              </p>
              <Select value={selectedSymbol} onValueChange={handleSymbolChange}>
                <SelectTrigger className="w-full border-primary/30 focus:ring-primary/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Select asset or all positions" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {allSymbols.length > 1 && (
                    <SelectItem value={ALL_POSITIONS_VALUE}>
                      <span className="flex items-center gap-2">
                        <LayoutGrid className="w-3 h-3" />
                        All Positions ({allSymbols.length})
                      </span>
                    </SelectItem>
                  )}
                  {allSymbols.map((sym) => {
                    const pos = positions.find((p) => p.symbol === sym);
                    return (
                      <SelectItem key={sym} value={sym}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{sym}</span>
                          {pos && (
                            <span className="text-xs text-muted-foreground">
                              {pos.positionType} · {pos.leverage}x
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Show selected position info */}
              {selectedSymbol !== ALL_POSITIONS_VALUE && (() => {
                const pos = positions.find((p) => p.symbol === selectedSymbol);
                if (!pos) return null;
                const livePrice = livePriceMap.get(selectedSymbol);
                return (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${pos.positionType === 'Long' ? 'border-chart-1/40 text-chart-1' : 'border-destructive/40 text-destructive'}`}
                    >
                      {pos.positionType}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {pos.leverage}x
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Entry: ${pos.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </span>
                    {livePrice !== undefined && (
                      <span className="text-xs text-chart-1">
                        Live: ${livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Fallback warning */}
            {isPricesError && (
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
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedSymbol === ALL_POSITIONS_VALUE
                      ? 'Total Portfolio Impact'
                      : `Impact on ${selectedSymbol}`}
                  </p>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
