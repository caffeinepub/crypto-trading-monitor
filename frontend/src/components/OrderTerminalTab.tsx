import { useState, useEffect, useCallback } from 'react';
import { useBinancePairs } from '../hooks/useBinancePairs';
import {
  placeMarketOrder,
  placeLimitOrder,
  placeStopMarketOrder,
  placeTakeProfitMarketOrder,
} from '../services/binanceProxyService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Terminal,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
type OrderSide = 'BUY' | 'SELL';

const FAPI_BASE = 'https://fapi.binance.com/fapi/v1';

export function OrderTerminalTab() {
  const { data: pairs, isLoading: pairsLoading, error: pairsError } = useBinancePairs();

  const [symbol, setSymbol] = useState('BTCUSDT');
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [isLive, setIsLive] = useState(() => localStorage.getItem('live_trading_enabled') === 'true');

  // Listen for live trading changes
  useEffect(() => {
    const handler = () => setIsLive(localStorage.getItem('live_trading_enabled') === 'true');
    window.addEventListener('live-trading-change', handler);
    return () => window.removeEventListener('live-trading-change', handler);
  }, []);

  // Fetch live price
  const fetchPrice = useCallback(async () => {
    if (!symbol) return;
    setPriceLoading(true);
    try {
      const res = await fetch(`${FAPI_BASE}/ticker/price?symbol=${symbol}`);
      if (!res.ok) throw new Error('Price fetch failed');
      const data = await res.json();
      setCurrentPrice(parseFloat(data.price));
    } catch {
      // silent
    } finally {
      setPriceLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const handlePlaceOrder = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0)) {
      toast.error('Please enter a valid price for Limit orders');
      return;
    }
    if ((orderType === 'STOP_MARKET' || orderType === 'TAKE_PROFIT_MARKET') && (!stopPrice || parseFloat(stopPrice) <= 0)) {
      toast.error('Please enter a valid stop price');
      return;
    }

    setPlacing(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let result;
      try {
        if (orderType === 'MARKET') {
          result = await placeMarketOrder(symbol, side, quantity);
        } else if (orderType === 'LIMIT') {
          result = await placeLimitOrder(symbol, side, quantity, price);
        } else if (orderType === 'STOP_MARKET') {
          result = await placeStopMarketOrder(symbol, side, quantity, stopPrice);
        } else {
          result = await placeTakeProfitMarketOrder(symbol, side, quantity, stopPrice);
        }
        clearTimeout(timeout);
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }

      toast.success(
        <div>
          <p className="font-semibold">Order Placed Successfully</p>
          <p className="text-xs opacity-80 font-mono">Order ID: {result.orderId}</p>
          <p className="text-xs opacity-80">{symbol} {side} {quantity} @ {orderType}</p>
        </div>
      );

      // Reset form
      setQuantity('');
      setPrice('');
      setStopPrice('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order placement failed';
      if (msg.includes('aborted') || msg.includes('timeout')) {
        toast.error('Order timed out after 15 seconds. Please check your connection.');
      } else {
        toast.error(`Order failed: ${msg}`);
      }
    } finally {
      setPlacing(false);
    }
  };

  const orderTypeLabel: Record<OrderType, string> = {
    MARKET: 'Market',
    LIMIT: 'Limit',
    STOP_MARKET: 'Stop Market',
    TAKE_PROFIT_MARKET: 'Take Profit Market',
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Order Terminal</h2>
          <Badge variant="outline" className="text-xs border-primary/40 text-primary ml-auto">
            Binance Futures
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Form */}
          <Card className="border-border/60 bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                New Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Symbol selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Trading Pair
                </Label>
                {pairsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : pairsError ? (
                  <div className="flex items-center gap-2 text-destructive text-sm p-2 border border-destructive/30 rounded-md bg-destructive/10">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Failed to load pairs
                  </div>
                ) : (
                  <Popover open={symbolOpen} onOpenChange={setSymbolOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={symbolOpen}
                        className="w-full justify-between font-mono border-border/60 bg-input hover:bg-accent"
                      >
                        {symbol || 'Select pair...'}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search pair..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No pair found.</CommandEmpty>
                          <CommandGroup>
                            {(pairs ?? []).map((pair) => (
                              <CommandItem
                                key={pair}
                                value={pair}
                                onSelect={(val) => {
                                  setSymbol(val.toUpperCase());
                                  setSymbolOpen(false);
                                }}
                                className="font-mono text-sm"
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    symbol === pair ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {pair}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Order Type */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Order Type
                </Label>
                <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
                  <SelectTrigger className="border-border/60 bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(orderTypeLabel) as OrderType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {orderTypeLabel[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Side selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Direction
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={side === 'BUY' ? 'default' : 'outline'}
                    className={cn(
                      'gap-2 font-semibold',
                      side === 'BUY'
                        ? 'bg-chart-1 text-background hover:bg-chart-1/90 border-chart-1'
                        : 'border-chart-1/40 text-chart-1 hover:bg-chart-1/10'
                    )}
                    onClick={() => setSide('BUY')}
                  >
                    <TrendingUp className="h-4 w-4" />
                    Long / Buy
                  </Button>
                  <Button
                    type="button"
                    variant={side === 'SELL' ? 'default' : 'outline'}
                    className={cn(
                      'gap-2 font-semibold',
                      side === 'SELL'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive'
                        : 'border-destructive/40 text-destructive hover:bg-destructive/10'
                    )}
                    onClick={() => setSide('SELL')}
                  >
                    <TrendingDown className="h-4 w-4" />
                    Short / Sell
                  </Button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Quantity
                </Label>
                <Input
                  type="number"
                  placeholder="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="font-mono border-border/60 bg-input"
                  min="0"
                  step="any"
                />
              </div>

              {/* Price (Limit only) */}
              {orderType === 'LIMIT' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Limit Price
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter price..."
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="font-mono border-border/60 bg-input"
                    min="0"
                    step="any"
                  />
                </div>
              )}

              {/* Stop Price (Stop Market / Take Profit Market) */}
              {(orderType === 'STOP_MARKET' || orderType === 'TAKE_PROFIT_MARKET') && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Stop Price
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter stop price..."
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className="font-mono border-border/60 bg-input"
                    min="0"
                    step="any"
                  />
                </div>
              )}

              {/* Place Order Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      className={cn(
                        'w-full font-semibold gap-2 mt-2',
                        side === 'BUY'
                          ? 'bg-chart-1 text-background hover:bg-chart-1/90'
                          : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                        (!isLive || placing) && 'opacity-60 cursor-not-allowed'
                      )}
                      disabled={!isLive || placing}
                      onClick={handlePlaceOrder}
                    >
                      {placing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : side === 'BUY' ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {placing
                        ? 'Placing Order...'
                        : `Place ${orderTypeLabel[orderType]} ${side === 'BUY' ? 'Long' : 'Short'}`}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!isLive && (
                  <TooltipContent side="top" className="max-w-xs text-center">
                    Enable Live Trading in Settings to place real orders on Binance Futures
                  </TooltipContent>
                )}
              </Tooltip>

              {!isLive && (
                <p className="text-xs text-center text-muted-foreground">
                  Live Trading is <span className="text-warning font-medium">OFF</span> — enable in Settings to trade
                </p>
              )}
            </CardContent>
          </Card>

          {/* Market Info Panel */}
          <Card className="border-border/60 bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Market Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Symbol display */}
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border/40">
                <span className="font-mono font-bold text-xl text-foreground">{symbol}</span>
                <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                  PERP
                </Badge>
              </div>

              {/* Live price */}
              <div className="p-4 rounded-md bg-accent/30 border border-border/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Live Price
                  </span>
                  <button
                    onClick={fetchPrice}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Refresh price"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', priceLoading && 'animate-spin')} />
                  </button>
                </div>
                {currentPrice ? (
                  <p className="font-mono text-2xl font-bold text-primary">
                    ${currentPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </p>
                ) : (
                  <Skeleton className="h-8 w-40" />
                )}
                <p className="text-xs text-muted-foreground mt-1">Updates every 5 seconds</p>
              </div>

              {/* Order summary */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Order Summary
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pair</span>
                    <span className="font-mono font-medium">{symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{orderTypeLabel[orderType]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Direction</span>
                    <span
                      className={cn(
                        'font-semibold',
                        side === 'BUY' ? 'text-profit' : 'text-loss'
                      )}
                    >
                      {side === 'BUY' ? '▲ Long' : '▼ Short'}
                    </span>
                  </div>
                  {quantity && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-mono font-medium">{quantity}</span>
                    </div>
                  )}
                  {orderType === 'LIMIT' && price && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limit Price</span>
                      <span className="font-mono font-medium">${price}</span>
                    </div>
                  )}
                  {(orderType === 'STOP_MARKET' || orderType === 'TAKE_PROFIT_MARKET') && stopPrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stop Price</span>
                      <span className="font-mono font-medium">${stopPrice}</span>
                    </div>
                  )}
                  {quantity && currentPrice && orderType === 'MARKET' && (
                    <div className="flex justify-between border-t border-border/40 pt-1.5 mt-1.5">
                      <span className="text-muted-foreground">Est. Value</span>
                      <span className="font-mono font-semibold text-primary">
                        ${(parseFloat(quantity) * currentPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Proxy notice */}
              <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                <p className="font-medium text-primary mb-0.5">🔒 Secure via ICP Proxy</p>
                Orders are routed through the Internet Computer canister — bypassing browser CORS restrictions.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default OrderTerminalTab;
