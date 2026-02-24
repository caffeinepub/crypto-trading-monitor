import { useState, useEffect, useCallback, useRef } from 'react';
import { Position } from '../types/position';
import { toast } from 'sonner';
import { isLiveTradingEnabled, getCredentials } from '../utils/liveTradingStorage';
import {
  placeMarketOrder,
  placeTakeProfitOrder,
  placeStopLossOrder,
  OrderParams,
} from '../services/binanceOrderService';

const POSITIONS_KEY = 'tracked_positions';

// Named constant for per-order timeout
const ORDER_CALL_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
    ),
  ]);
}

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Position[];
  } catch {
    return [];
  }
}

function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

export function usePositionStorage() {
  const [positions, setPositions] = useState<Position[]>(() => loadPositions());

  // Use a ref for the storage event handler to avoid re-registering on every render
  const storageHandlerRef = useRef<((e: StorageEvent) => void) | null>(null);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === POSITIONS_KEY) {
        setPositions(loadPositions());
      }
    };
    storageHandlerRef.current = handler;

    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storage', handler);
    };
  }, []); // Empty dependency array — register once only

  const addPosition = useCallback(async (position: Position) => {
    // Always save to localStorage first — order placement never blocks persistence
    const updated = [...loadPositions(), position];
    savePositions(updated);
    setPositions(updated);

    // Fire-and-forget live order placement if live trading is active
    if (!isLiveTradingEnabled()) return;

    const creds = getCredentials();
    if (!creds) {
      toast.warning('Live Trading ativo mas sem credenciais — posição salva localmente apenas.');
      return;
    }

    // Derive quantity from totalExposure / entryPrice (number of contracts)
    const quantity = parseFloat((position.totalExposure / position.entryPrice).toFixed(3));
    const side: 'BUY' | 'SELL' = position.positionType === 'Long' ? 'BUY' : 'SELL';
    const closeSide: 'BUY' | 'SELL' = position.positionType === 'Long' ? 'SELL' : 'BUY';
    const symbol = position.symbol.replace('/', '').replace('-', '');

    // Entry order — individual try/catch with 10-second timeout
    const entryParams: OrderParams = { symbol, side, quantity, credentials: creds };
    try {
      await withTimeout(
        placeMarketOrder(entryParams),
        ORDER_CALL_TIMEOUT_MS,
        'entry'
      );
      toast.success(`Ordem de entrada enviada à Binance: ${symbol}`);
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
      if (isTimeout) {
        toast.warning(`Ordem de entrada expirou — posição ${symbol} salva localmente apenas.`);
      } else {
        toast.error(`Falha na ordem de entrada ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    // TP orders — one per TP level, each with individual try/catch
    for (const tp of position.takeProfitLevels) {
      const tpParams: OrderParams = {
        symbol,
        side: closeSide,
        quantity,
        credentials: creds,
        stopPrice: tp.price,
        reduceOnly: true,
      };
      try {
        await withTimeout(
          placeTakeProfitOrder(tpParams),
          ORDER_CALL_TIMEOUT_MS,
          `tp${tp.level}`
        );
      } catch (err: unknown) {
        const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
        if (isTimeout) {
          toast.warning(`Ordem TP${tp.level} expirou — ${symbol} sem TP${tp.level} na Binance.`);
        } else {
          toast.error(`Falha na ordem TP${tp.level} ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        }
      }
    }

    // SL order — individual try/catch with 10-second timeout
    const slParams: OrderParams = {
      symbol,
      side: closeSide,
      quantity,
      credentials: creds,
      stopPrice: position.stopLoss.price,
      reduceOnly: true,
    };
    try {
      await withTimeout(
        placeStopLossOrder(slParams),
        ORDER_CALL_TIMEOUT_MS,
        'sl'
      );
      toast.success(`Ordem SL enviada à Binance: ${symbol}`);
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
      if (isTimeout) {
        toast.warning(`Ordem SL expirou — ${symbol} sem SL na Binance.`);
      } else {
        toast.error(`Falha na ordem SL ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  }, []);

  const removePosition = useCallback((id: string) => {
    const updated = loadPositions().filter((p) => p.id !== id);
    savePositions(updated);
    setPositions(updated);
  }, []);

  const updatePosition = useCallback((position: Position) => {
    const current = loadPositions();
    const updated = current.map((p) => (p.id === position.id ? position : p));
    savePositions(updated);
    setPositions(updated);
  }, []);

  return {
    positions,
    addPosition,
    removePosition,
    updatePosition,
    // Backward compatibility alias
    deletePosition: removePosition,
  };
}
