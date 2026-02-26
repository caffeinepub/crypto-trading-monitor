import { useState, useEffect, useCallback } from 'react';
import { hasCredentials, getCredentials } from '../utils/credentialsStorage';
import { calculatePnL } from '../utils/pnlCalculations';
import type { Position } from '../types/position';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';

const POSITIONS_KEY = 'bot_positions';
const FAPI_BASE = 'https://fapi.binance.com/fapi/v1';

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePositions(positions: Position[]): void {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

interface PositionWithPrice extends Position {
  currentPrice: number | null;
}

interface BinancePositionRisk {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  leverage: string;
  unrealizedProfit: string;
}

export function DashboardTab({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [credentialed, setCredentialed] = useState<boolean>(() => hasCredentials());
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);

  // React to credential changes
  useEffect(() => {
    const handler = () => setCredentialed(hasCredentials());
    window.addEventListener('credential-change', handler);
    return () => window.removeEventListener('credential-change', handler);
  }, []);

  // Fetch live prices every 5 seconds
  const fetchPrices = useCallback(async () => {
    if (positions.length === 0) return;
    setPricesLoading(true);
    try {
      const symbols = [...new Set(positions.map((p) => p.symbol))];
      const results = await Promise.allSettled(
        symbols.map(async (sym) => {
          const res = await fetch(`${FAPI_BASE}/ticker/price?symbol=${sym}`);
          if (!res.ok) throw new Error(`Failed price for ${sym}`);
          const data = await res.json();
          return { symbol: sym, price: parseFloat(data.price) };
        })
      );
      const newPrices: Record<string, number> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          newPrices[r.value.symbol] = r.value.price;
        }
      });
      setPrices((prev) => ({ ...prev, ...newPrices }));
    } catch {
      // silent
    } finally {
      setPricesLoading(false);
    }
  }, [positions]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const importPositions = async () => {
    if (!hasCredentials()) {
      toast.error('No API credentials configured');
      return;
    }
    setImporting(true);
    try {
      const { apiKey, apiSecret } = getCredentials();
      const actor = (window as unknown as { __binanceActor?: unknown }).__binanceActor as {
        placeMarketOrder?: unknown;
        cancelOrder?: unknown;
      } | undefined;

      if (!actor) {
        toast.error('Backend actor not ready. Please wait a moment and try again.');
        return;
      }

      // Use direct authenticated fetch via the proxy — we call a simple account endpoint
      // Since the backend only has order methods, we use the public positionRisk endpoint
      // with credentials passed as query params (Binance requires HMAC signature)
      // For now, we fetch via the browser using the stored credentials
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;

      // HMAC-SHA256 signing in browser using SubtleCrypto
      const encoder = new TextEncoder();
      const keyData = encoder.encode(apiSecret);
      const msgData = encoder.encode(queryString);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signature = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const url = `https://fapi.binance.com/fapi/v2/positionRisk?${queryString}&signature=${signature}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: { 'X-MBX-APIKEY': apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.msg ?? `HTTP ${response.status}`);
      }

      const data: BinancePositionRisk[] = await response.json();
      const openPositions = data.filter((p) => parseFloat(p.positionAmt) !== 0);

      const mapped: Position[] = openPositions.map((p) => ({
        id: `${p.symbol}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? 'Long' : 'Short',
        entryPrice: parseFloat(p.entryPrice),
        quantity: Math.abs(parseFloat(p.positionAmt)),
        leverage: parseInt(p.leverage, 10) || 1,
      }));

      setPositions(mapped);
      savePositions(mapped);
      toast.success(`Imported ${mapped.length} open position${mapped.length !== 1 ? 's' : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(`Import failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const removePosition = (id: string) => {
    const updated = positions.filter((p) => p.id !== id);
    setPositions(updated);
    savePositions(updated);
    toast.success('Position removed');
  };

  const enriched: PositionWithPrice[] = positions.map((p) => ({
    ...p,
    currentPrice: prices[p.symbol] ?? null,
  }));

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Open Positions</h2>
          {positions.length > 0 && (
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              {positions.length}
            </Badge>
          )}
        </div>
        {credentialed && (
          <Button
            size="sm"
            variant="outline"
            onClick={importPositions}
            disabled={importing}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
          >
            {importing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {importing ? 'Importing...' : 'Import Positions'}
          </Button>
        )}
      </div>

      {/* Onboarding banner */}
      {!credentialed && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">API Credentials Required</AlertTitle>
          <AlertDescription className="text-muted-foreground mt-1">
            Configure your Binance API Key and Secret to import positions and place orders.
            <Button
              variant="link"
              size="sm"
              className="text-primary p-0 h-auto ml-2 font-semibold"
              onClick={onOpenSettings}
            >
              Open Settings →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Positions list */}
      {enriched.length === 0 && credentialed && (
        <div className="text-center py-16 text-muted-foreground">
          <LayoutDashboard className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No positions loaded.</p>
          <p className="text-xs mt-1">Click "Import Positions" to fetch from Binance.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {enriched.map((pos) => {
          const pnl = pos.currentPrice
            ? calculatePnL(pos, pos.currentPrice)
            : null;
          const isProfit = pnl ? pnl.pnlUsd >= 0 : null;

          return (
            <Card
              key={pos.id}
              className="border-border/60 bg-card shadow-card-glow relative overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 w-1 h-full ${
                  pos.side === 'Long' ? 'bg-chart-1' : 'bg-destructive'
                }`}
              />
              <CardHeader className="pb-2 pl-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-mono font-semibold">
                      {pos.symbol}
                    </CardTitle>
                    <Badge
                      className={
                        pos.side === 'Long'
                          ? 'bg-chart-1/20 text-chart-1 border border-chart-1/40 text-xs'
                          : 'bg-destructive/20 text-destructive border border-destructive/40 text-xs'
                      }
                    >
                      {pos.side === 'Long' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {pos.side}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {pos.leverage}x
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removePosition(pos.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pl-5 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Entry</span>
                    <p className="font-mono font-medium">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Qty</span>
                    <p className="font-mono font-medium">{pos.quantity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current</span>
                    {pos.currentPrice ? (
                      <p className="font-mono font-medium">
                        ${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </p>
                    ) : (
                      <Skeleton className="h-4 w-20 mt-0.5" />
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">PnL</span>
                    {pnl ? (
                      <p
                        className={`font-mono font-semibold ${
                          isProfit ? 'text-profit' : 'text-loss'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {pnl.pnlUsd.toFixed(2)} USD
                        <span className="text-xs ml-1 opacity-80">
                          ({isProfit ? '+' : ''}{pnl.pnlPercent.toFixed(2)}%)
                        </span>
                      </p>
                    ) : (
                      <Skeleton className="h-4 w-24 mt-0.5" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardTab;
