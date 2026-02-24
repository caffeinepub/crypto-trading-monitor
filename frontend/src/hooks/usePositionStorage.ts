import { useState, useCallback } from 'react';
import { Position } from '../types/position';
import { isLiveTradingReady, getBinanceCredentials } from '../utils/liveTradingStorage';
import { toast } from 'sonner';

const POSITIONS_KEY = 'trading_positions';

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Position[];
  } catch {
    return [];
  }
}

function persistPositions(positions: Position[]): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // ignore storage errors
  }
}

/**
 * Places live Binance Futures orders for a position when live trading is active.
 * Each order is wrapped in its own try/catch so a failure in one does not abort the others.
 */
async function placeLiveOrders(position: Position): Promise<void> {
  const credentials = getBinanceCredentials();
  if (!credentials) return;

  // Dynamically import to keep module load non-blocking
  const { placeMarketOrder, placeTakeProfitOrder, placeStopLossOrder } = await import(
    '../services/binanceOrderService'
  );

  // Binance symbol format: no slash, no dash (e.g. BTCUSDT)
  const symbol = position.symbol.replace('/', '').replace('-', '');
  const side = position.positionType === 'Long' ? ('BUY' as const) : ('SELL' as const);
  const closeSide = position.positionType === 'Long' ? ('SELL' as const) : ('BUY' as const);

  // Quantity = total exposure / entry price (number of contracts)
  const quantity = parseFloat((position.totalExposure / position.entryPrice).toFixed(3));

  // 1. Market entry order
  try {
    await placeMarketOrder({ symbol, side, quantity, credentials });
    toast.success(`✅ Entry order placed: ${side} ${quantity} ${symbol}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(`Entry order failed for ${symbol}: ${msg}`);
  }

  // 2. Take-profit orders (one per TP level)
  for (const tp of position.takeProfitLevels) {
    try {
      await placeTakeProfitOrder({
        symbol,
        side: closeSide,
        quantity,
        stopPrice: tp.price,
        credentials,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`TP${tp.level} order failed at ${tp.price}: ${msg}`);
    }
  }

  // 3. Stop-loss order — stopLoss is a StopLossRecommendation object, use .price
  try {
    await placeStopLossOrder({
      symbol,
      side: closeSide,
      quantity,
      stopPrice: position.stopLoss.price,
      credentials,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(`SL order failed at ${position.stopLoss.price}: ${msg}`);
  }
}

export function usePositionStorage() {
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());

  const addPosition = useCallback(async (position: Position) => {
    // Update local state and storage immediately — non-blocking
    setPositions((prev) => {
      const updated = [...prev, position];
      persistPositions(updated);
      return updated;
    });

    // Place live orders asynchronously (fire-and-forget)
    if (isLiveTradingReady()) {
      placeLiveOrders(position).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Order placement error: ${msg}`);
      });
    }
  }, []);

  const updatePosition = useCallback((id: string, updates: Partial<Position>) => {
    setPositions((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      persistPositions(updated);
      return updated;
    });
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      persistPositions(updated);
      return updated;
    });
  }, []);

  const clearPositions = useCallback(() => {
    setPositions([]);
    persistPositions([]);
  }, []);

  // Expose deletePosition as an alias for removePosition for backward compatibility
  const deletePosition = removePosition;

  return {
    positions,
    addPosition,
    updatePosition,
    removePosition,
    deletePosition,
    clearPositions,
  };
}
