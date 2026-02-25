import { useState, useCallback } from 'react';
import { Position } from '@/types/position';
import {
  placeMarketOrder,
  placeTakeProfitMarketOrder,
  placeStopLossOrder,
  OrderParams,
} from '@/services/binanceOrderService';
import { getCredentials } from '@/utils/liveTradingStorage';

const POSITIONS_KEY = 'positions';

export function getPositionsFromStorage(): Position[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePositionsToStorage(positions: Position[]): void {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  window.dispatchEvent(new CustomEvent('positions-changed'));
}

export function updatePositionInStorage(
  positionId: string,
  updates: Partial<Position>
): void {
  const positions = getPositionsFromStorage();
  const idx = positions.findIndex(p => p.id === positionId);
  if (idx === -1) return;
  positions[idx] = { ...positions[idx], ...updates };
  savePositionsToStorage(positions);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export function usePositionStorage() {
  const [positions, setPositions] = useState<Position[]>(() =>
    getPositionsFromStorage()
  );

  const refreshPositions = useCallback(() => {
    setPositions(getPositionsFromStorage());
  }, []);

  const addPosition = useCallback(
    async (position: Position): Promise<void> => {
      const credentials = getCredentials();
      const current = getPositionsFromStorage();
      const updated = [...current, position];
      savePositionsToStorage(updated);
      setPositions(updated);

      if (credentials) {
        // Determine close side from positionType field
        const posType = (position as any).positionType as string | undefined;
        const legacyType = (position as any).type as string | undefined;
        const isLong = posType === 'Long' || legacyType === 'Long';
        const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';

        // Compute quantity from totalExposure / entryPrice if quantity not present
        const qty: number =
          (position as any).quantity ??
          ((position as any).totalExposure && (position as any).entryPrice
            ? (position as any).totalExposure / (position as any).entryPrice
            : 0);

        if (qty > 0) {
          const orderBase: OrderParams = {
            symbol: position.symbol,
            side: closeSide,
            quantity: qty,
            credentials,
          };

          if (position.takeProfitLevels?.length) {
            for (const tp of position.takeProfitLevels) {
              try {
                await withTimeout(
                  placeTakeProfitMarketOrder({
                    ...orderBase,
                    stopPrice: tp.price,
                  }),
                  10000
                );
              } catch {
                // individual TP order failure is non-fatal
              }
            }
          }

          if (position.stopLoss?.price) {
            try {
              await withTimeout(
                placeStopLossOrder({
                  ...orderBase,
                  stopPrice: position.stopLoss.price,
                }),
                10000
              );
            } catch {
              // SL order failure is non-fatal
            }
          }
        }
      }
    },
    []
  );

  const removePosition = useCallback(
    async (positionId: string): Promise<void> => {
      const current = getPositionsFromStorage();
      const position = current.find(p => p.id === positionId);
      const updated = current.filter(p => p.id !== positionId);
      savePositionsToStorage(updated);
      setPositions(updated);

      if (position) {
        const credentials = getCredentials();
        if (credentials) {
          const posType = (position as any).positionType as string | undefined;
          const legacyType = (position as any).type as string | undefined;
          const isLong = posType === 'Long' || legacyType === 'Long';
          const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';

          const qty: number =
            (position as any).quantity ??
            ((position as any).totalExposure && (position as any).entryPrice
              ? (position as any).totalExposure / (position as any).entryPrice
              : 0);

          if (qty > 0) {
            try {
              await withTimeout(
                placeMarketOrder({
                  symbol: position.symbol,
                  side: closeSide,
                  quantity: qty,
                  credentials,
                }),
                10000
              );
            } catch {
              // close order failure is non-fatal
            }
          }
        }
      }
    },
    []
  );

  const updatePosition = useCallback(
    (positionId: string, updates: Partial<Position>): void => {
      updatePositionInStorage(positionId, updates);
      setPositions(getPositionsFromStorage());
    },
    []
  );

  return {
    positions,
    addPosition,
    removePosition,
    updatePosition,
    refreshPositions,
  };
}
