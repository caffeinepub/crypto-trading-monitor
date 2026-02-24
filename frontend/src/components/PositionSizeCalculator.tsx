import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calculator,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Wifi,
  WifiOff,
  ChevronsUpDown,
  Check,
  AlertCircle,
} from 'lucide-react';
import { calculatePositionSize } from '../utils/positionSizeCalculator';
import { PositionSizeResult } from '../types/calculator';
import { getTotalCapital } from '../utils/totalCapitalStorage';
import { fetchTickerPrice, fetchLeverageBracket, LeverageBracket } from '../services/binanceApi';
import { useBinancePairs } from '../hooks/useBinancePairs';

interface PositionSizeCalculatorProps {
  onApply?: (result: PositionSizeResult & { stopLossPrice: number }) => void;
}

export function PositionSizeCalculator({ onApply }: PositionSizeCalculatorProps) {
  const [capital, setCapital] = useState<string>('');
  const [riskPercentage, setRiskPercentage] = useState<number>(2);
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLossPrice, setStopLossPrice] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(10);
  const [result, setResult] = useState<PositionSizeResult | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [useLivePrice, setUseLivePrice] = useState<boolean>(false);
  const [pairSearchOpen, setPairSearchOpen] = useState<boolean>(false);
  const [pairSearch, setPairSearch] = useState<string>('');

  // Load total capital on mount
  useEffect(() => {
    const storedCapital = getTotalCapital();
    if (storedCapital !== null) {
      setCapital(storedCapital.toString());
    }
  }, []);

  // Fetch all perpetual pairs using the shared hook
  const {
    data: pairs,
    isLoading: isPairsLoading,
    isError: isPairsError,
  } = useBinancePairs();

  // Filter pairs based on search input
  const filteredPairs = useMemo(() => {
    if (!pairs) return [];
    const q = pairSearch.trim().toUpperCase();
    if (!q) return pairs;
    return pairs.filter((p) => p.includes(q));
  }, [pairs, pairSearch]);

  // Fetch live ticker price for selected symbol
  const {
    data: tickerData,
    isLoading: isPriceLoading,
    isError: isPriceError,
    refetch: refetchPrice,
  } = useQuery({
    queryKey: ['ticker-price', selectedSymbol],
    queryFn: () => fetchTickerPrice(selectedSymbol),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  // Fetch leverage bracket for selected symbol
  const {
    data: bracketData,
    isError: isBracketError,
  } = useQuery({
    queryKey: ['leverage-bracket', selectedSymbol],
    queryFn: () => fetchLeverageBracket(selectedSymbol),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const livePrice = tickerData ? parseFloat(tickerData.price) : null;

  // Find the bracket that applies to the current leverage
  const symbolBrackets: LeverageBracket[] = bracketData?.[0]?.brackets ?? [];
  const maxAllowedLeverage = symbolBrackets.length > 0 ? symbolBrackets[0].initialLeverage : null;
  const currentBracket =
    symbolBrackets.find(
      (b) =>
        leverage <= b.initialLeverage &&
        leverage > (symbolBrackets[symbolBrackets.indexOf(b) + 1]?.initialLeverage ?? 0)
    ) ?? symbolBrackets[symbolBrackets.length - 1];
  const maintMarginRatio = currentBracket?.maintMarginRatio ?? null;
  const leverageExceedsMax = maxAllowedLeverage !== null && leverage > maxAllowedLeverage;

  // Apply live price to entry field when toggled
  const handleUseLivePrice = useCallback(() => {
    if (livePrice !== null) {
      setEntryPrice(livePrice.toString());
      setUseLivePrice(true);
    }
  }, [livePrice]);

  useEffect(() => {
    const capitalNum = parseFloat(capital);
    const entryNum = parseFloat(entryPrice);
    const slNum = parseFloat(stopLossPrice);

    if (capitalNum > 0 && entryNum > 0 && slNum > 0 && slNum !== entryNum) {
      const calculated = calculatePositionSize({
        capital: capitalNum,
        riskPercentage,
        stopLossPrice: slNum,
        entryPrice: entryNum,
        leverage,
      });
      setResult(calculated);
    } else {
      setResult(null);
    }
  }, [capital, riskPercentage, entryPrice, stopLossPrice, leverage]);

  const handleApply = () => {
    if (result && onApply) {
      onApply({ ...result, stopLossPrice: parseFloat(stopLossPrice) });
    }
  };

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setUseLivePrice(false);
    setPairSearchOpen(false);
    setPairSearch('');
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" />
          Position Size Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol Selector — searchable combobox with all perpetual pairs */}
        <div className="space-y-2">
          <Label>Symbol</Label>

          {isPairsError && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">
                Unable to load Binance perpetual pairs. Check your connection and try again.
              </p>
            </div>
          )}

          <Popover open={pairSearchOpen} onOpenChange={setPairSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={pairSearchOpen}
                className="w-full justify-between border-primary/30 hover:bg-primary/5 font-mono"
                disabled={isPairsLoading}
              >
                {isPairsLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Loading pairs…
                  </span>
                ) : (
                  <span>{selectedSymbol}</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search pair (e.g. BTC, ETH)…"
                  value={pairSearch}
                  onValueChange={setPairSearch}
                />
                <CommandList>
                  {isPairsLoading && (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  )}
                  {!isPairsLoading && filteredPairs.length === 0 && (
                    <CommandEmpty>No pairs found.</CommandEmpty>
                  )}
                  {!isPairsLoading && filteredPairs.length > 0 && (
                    <CommandGroup heading={`${filteredPairs.length} pair${filteredPairs.length !== 1 ? 's' : ''}`}>
                      {filteredPairs.map((pair) => (
                        <CommandItem
                          key={pair}
                          value={pair}
                          onSelect={() => handleSelectSymbol(pair)}
                          className="font-mono text-sm cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedSymbol === pair ? 'opacity-100 text-primary' : 'opacity-0'}`}
                          />
                          {pair}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {!isPairsLoading && !isPairsError && pairs && (
            <p className="text-xs text-muted-foreground">
              {pairs.length} Binance USD-M perpetual pairs available
            </p>
          )}
        </div>

        {/* Live Price Reference */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isPriceError ? (
                <WifiOff className="w-3 h-3 text-destructive" />
              ) : (
                <Wifi className="w-3 h-3 text-chart-1" />
              )}
              Live Price ({selectedSymbol})
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => refetchPrice()}
              disabled={isPriceLoading}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isPriceLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {isPriceError ? (
            <p className="text-xs text-destructive">Unable to fetch live price. Using manual input.</p>
          ) : isPriceLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">Fetching price…</p>
          ) : livePrice !== null ? (
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">
                ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleUseLivePrice}
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Use as Entry
              </Button>
            </div>
          ) : null}

          {/* Leverage bracket info */}
          {!isBracketError && maxAllowedLeverage !== null && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-primary/10">
              <span className="text-xs text-muted-foreground">Max leverage:</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {maxAllowedLeverage}x
              </Badge>
              {maintMarginRatio !== null && (
                <>
                  <span className="text-xs text-muted-foreground">Maint. margin:</span>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {(maintMarginRatio * 100).toFixed(2)}%
                  </Badge>
                </>
              )}
            </div>
          )}
        </div>

        {/* Leverage warning */}
        {leverageExceedsMax && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-400">
              Selected leverage ({leverage}x) exceeds the maximum allowed ({maxAllowedLeverage}x) for{' '}
              {selectedSymbol}.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="capital">Total Capital (USD)</Label>
          <Input
            id="capital"
            type="number"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="Enter your trading capital"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Risk Percentage</Label>
            <span className="text-sm font-medium text-primary">{riskPercentage}%</span>
          </div>
          <Slider
            value={[riskPercentage]}
            onValueChange={(value) => setRiskPercentage(value[0])}
            min={0.5}
            max={10}
            step={0.5}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">Recommended: 1-3% per trade</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="entry">
              Entry Price
              {useLivePrice && (
                <Badge variant="outline" className="ml-2 text-xs border-chart-1/40 text-chart-1">
                  Live
                </Badge>
              )}
            </Label>
            <Input
              id="entry"
              type="number"
              value={entryPrice}
              onChange={(e) => {
                setEntryPrice(e.target.value);
                setUseLivePrice(false);
              }}
              placeholder="50000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sl">Stop Loss Price</Label>
            <Input
              id="sl"
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              placeholder="48000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Leverage</Label>
            <span className={`text-sm font-medium ${leverageExceedsMax ? 'text-amber-400' : 'text-primary'}`}>
              {leverage}x
            </span>
          </div>
          <Slider
            value={[leverage]}
            onValueChange={(value) => setLeverage(value[0])}
            min={1}
            max={125}
            step={1}
            className="py-2"
          />
        </div>

        {result && (
          <>
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Position Size</span>
                <span className="text-lg font-bold text-primary">${result.positionSize.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contracts</span>
                <span className="font-medium">{result.contracts.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Amount</span>
                <span className="font-medium text-destructive">${result.riskAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Potential Reward</span>
                <span className="font-medium text-chart-1">${result.rewardAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk:Reward Ratio</span>
                <span className="font-bold text-primary">1:{result.riskRewardRatio.toFixed(2)}</span>
              </div>
            </div>

            {onApply && (
              <Button onClick={handleApply} className="w-full bg-primary hover:bg-primary/90">
                <ArrowRight className="w-4 h-4 mr-2" />
                Apply to Position Form
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
