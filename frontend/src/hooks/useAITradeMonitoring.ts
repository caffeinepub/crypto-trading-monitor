import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { AITrade } from '@/types/aiTrade';
import { fetchCurrentPrices, fetchKlines, BinanceKline } from '@/services/binanceApi';
import { detectMarketReversal } from '@/utils/marketReversalDetector';
import { addAITradeRecord } from '@/utils/aiTradeHistoryStorage';
import { useAITradeStorage } from '@/hooks/useAITradeStorage';
import {
  isLiveTradingEnabled,
  getModalityLiveOrders,
  getCredentials,
} from '@/utils/liveTradingStorage';
import {
  placeMarketOrder,
  placeStopLossOrder,
  cancelOrder,
  getOpenOrders,
} from '@/services/binanceOrderService';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function getTradeQuantity(trade: AITrade): number {
  const t = trade as any;
  if (typeof t.quantity === 'number' && t.quantity > 0) return t.quantity;
  if (typeof trade.investmentAmount === 'number' && typeof trade.entryPrice === 'number' && trade.entryPrice > 0) {
    return trade.investmentAmount / trade.entryPrice;
  }
  return 0;
}

function getTradeOpenedAt(trade: AITrade): string {
  const t = trade as any;
  return t.openedAt || t.createdAt || new Date().toISOString();
}

async function cancelExistingStopMarket(
  symbol: string,
  storedOrderId?: number
): Promise<void> {
  const credentials = getCredentials();
  if (!credentials) return;

  if (storedOrderId) {
    try {
      await withTimeout(cancelOrder(symbol, storedOrderId, credentials), 10000);
    } catch {
      // If cancel fails, try to find via open orders
    }
    return;
  }

  try {
    const openOrders = await withTimeout(getOpenOrders(symbol, credentials), 10000);
    const stopOrder = openOrders.find(o => o.type === 'STOP_MARKET');
    if (stopOrder) {
      await withTimeout(cancelOrder(symbol, stopOrder.orderId, credentials), 10000);
    }
  } catch {
    // non-fatal
  }
}

export function useAITradeMonitoring(trades: AITrade[] | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef<Set<string>>(new Set());
  const { saveTrades, getTrades } = useAITradeStorage();

  const saveRecord = useCallback((record: any) => {
    try {
      addAITradeRecord(record);
    } catch {
      // non-fatal
    }
  }, []);

  const persistTrades = useCallback((allTrades: AITrade[]) => {
    saveTrades(allTrades);
    localStorage.setItem('ai_daily_trades', JSON.stringify(allTrades));
  }, [saveTrades]);

  const handleTPHit = useCallback(
    async (trade: AITrade, tpLevel: 1 | 2 | 3, currentPrice: number) => {
      if (processingRef.current.has(`${trade.id}-tp${tpLevel}`)) return;
      processingRef.current.add(`${trade.id}-tp${tpLevel}`);

      const liveEnabled = isLiveTradingEnabled();
      const modalityOrders = getModalityLiveOrders();
      const modalityLive = modalityOrders[trade.modality] ?? false;
      const shouldPlaceLiveOrders = liveEnabled && modalityLive;
      const credentials = getCredentials();

      const isLong = trade.positionType === 'Long';
      const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';
      const qty = getTradeQuantity(trade);

      try {
        const allTrades = getTrades();
        const idx = allTrades.findIndex(t => t.id === trade.id);
        if (idx === -1) return;

        const updatedTrade = { ...allTrades[idx] } as any;

        if (tpLevel === 1 && !updatedTrade.tp1Executed) {
          updatedTrade.tp1Executed = true;
          updatedTrade.effectiveSL = updatedTrade.entryPrice;
          updatedTrade.riskManagementStep = 'breakeven';

          if (shouldPlaceLiveOrders && credentials && qty > 0) {
            try {
              await cancelExistingStopMarket(trade.symbol, updatedTrade.stopLossOrderId);
            } catch {
              toast.error(`TP1 order update failed — SL not moved to breakeven`);
            }

            try {
              const slResult = await withTimeout(
                placeStopLossOrder({
                  symbol: trade.symbol,
                  side: closeSide,
                  quantity: qty,
                  stopPrice: updatedTrade.entryPrice,
                  credentials,
                }),
                10000
              );
              updatedTrade.stopLossOrderId = slResult.orderId;
              toast.success(`TP1 atingido — SL movido para breakeven`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`TP1: Falha ao mover SL para breakeven — ${msg}`);
            }
          } else {
            toast.success(`TP1 atingido para ${trade.symbol}`);
          }
        } else if (tpLevel === 2 && !updatedTrade.tp2Executed) {
          updatedTrade.tp2Executed = true;
          updatedTrade.effectiveSL = updatedTrade.tp1;
          updatedTrade.riskManagementStep = 'trailing';

          if (shouldPlaceLiveOrders && credentials && qty > 0) {
            try {
              await cancelExistingStopMarket(trade.symbol, updatedTrade.stopLossOrderId);
            } catch {
              // non-fatal
            }

            try {
              const slResult = await withTimeout(
                placeStopLossOrder({
                  symbol: trade.symbol,
                  side: closeSide,
                  quantity: qty,
                  stopPrice: updatedTrade.tp1,
                  credentials,
                }),
                10000
              );
              updatedTrade.stopLossOrderId = slResult.orderId;
              toast.success(`TP2 atingido — SL movido para TP1`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`TP2: Falha ao mover SL para TP1 — ${msg}`);
            }
          } else {
            toast.success(`TP2 atingido para ${trade.symbol}`);
          }
        } else if (tpLevel === 3 && !updatedTrade.tp3Executed) {
          updatedTrade.tp3Executed = true;
          updatedTrade.status = 'TPHit';

          if (shouldPlaceLiveOrders && credentials && qty > 0) {
            try {
              await withTimeout(
                placeMarketOrder({
                  symbol: trade.symbol,
                  side: closeSide,
                  quantity: qty,
                  credentials,
                }),
                10000
              );
              toast.success(`TP3 atingido — posição fechada no mercado`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`TP3: Falha ao fechar posição — ${msg}`);
            }
          } else {
            toast.success(`TP3 atingido para ${trade.symbol}`);
          }

          const pnl = isLong
            ? (currentPrice - trade.entryPrice) * qty
            : (trade.entryPrice - currentPrice) * qty;

          saveRecord({
            id: `${trade.id}-close`,
            symbol: trade.symbol,
            modality: trade.modality,
            positionType: trade.positionType,
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            investment: trade.investmentAmount,
            pnlUsd: pnl,
            pnlPercent: trade.entryPrice > 0 ? (pnl / trade.investmentAmount) * 100 : 0,
            outcome: 'TP Hit' as const,
            timestamp: Date.now(),
          });

          window.dispatchEvent(
            new CustomEvent('ai-trade-regenerate', { detail: { modality: trade.modality } })
          );
        }

        allTrades[idx] = updatedTrade as AITrade;
        persistTrades(allTrades);
      } finally {
        processingRef.current.delete(`${trade.id}-tp${tpLevel}`);
      }
    },
    [getTrades, persistTrades, saveRecord]
  );

  const handleSLHit = useCallback(
    async (trade: AITrade, currentPrice: number) => {
      if (processingRef.current.has(`${trade.id}-sl`)) return;
      processingRef.current.add(`${trade.id}-sl`);

      const liveEnabled = isLiveTradingEnabled();
      const modalityOrders = getModalityLiveOrders();
      const modalityLive = modalityOrders[trade.modality] ?? false;
      const shouldPlaceLiveOrders = liveEnabled && modalityLive;
      const credentials = getCredentials();

      const isLong = trade.positionType === 'Long';
      const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';
      const qty = getTradeQuantity(trade);

      try {
        if (shouldPlaceLiveOrders && credentials && qty > 0) {
          try {
            await withTimeout(
              placeMarketOrder({
                symbol: trade.symbol,
                side: closeSide,
                quantity: qty,
                credentials,
              }),
              10000
            );
            toast.error(`SL atingido — posição fechada para ${trade.symbol}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`SL: Falha ao fechar posição — ${msg}`);
          }
        } else {
          toast.error(`SL atingido para ${trade.symbol}`);
        }

        const pnl = isLong
          ? (currentPrice - trade.entryPrice) * qty
          : (trade.entryPrice - currentPrice) * qty;

        saveRecord({
          id: `${trade.id}-sl`,
          symbol: trade.symbol,
          modality: trade.modality,
          positionType: trade.positionType,
          entryPrice: trade.entryPrice,
          exitPrice: currentPrice,
          investment: trade.investmentAmount,
          pnlUsd: pnl,
          pnlPercent: trade.investmentAmount > 0 ? (pnl / trade.investmentAmount) * 100 : 0,
          outcome: 'SL Hit' as const,
          timestamp: Date.now(),
        });

        const allTrades = getTrades();
        const idx = allTrades.findIndex(t => t.id === trade.id);
        if (idx !== -1) {
          (allTrades[idx] as any).status = 'SLHit';
          persistTrades(allTrades);
        }

        window.dispatchEvent(
          new CustomEvent('ai-trade-regenerate', { detail: { modality: trade.modality } })
        );
      } finally {
        processingRef.current.delete(`${trade.id}-sl`);
      }
    },
    [getTrades, persistTrades, saveRecord]
  );

  const checkPrices = useCallback(async () => {
    if (!trades || trades.length === 0) return;

    const activeTrades = trades.filter(t => {
      const status = t.status as string;
      return status === 'Open' || status === 'open' || status === 'active';
    });
    if (activeTrades.length === 0) return;

    const symbols = [...new Set(activeTrades.map(t => t.symbol))];

    let priceMap: Record<string, number> = {};
    try {
      const pricesResult = await fetchCurrentPrices(symbols);
      // fetchCurrentPrices returns TickerPriceResponse[] — convert to map
      if (Array.isArray(pricesResult)) {
        for (const item of pricesResult as any[]) {
          if (item.symbol && item.price != null) {
            priceMap[item.symbol] = typeof item.price === 'string'
              ? parseFloat(item.price)
              : item.price;
          }
        }
      } else if (typeof pricesResult === 'object') {
        priceMap = pricesResult as unknown as Record<string, number>;
      }
    } catch {
      return;
    }

    for (const trade of activeTrades) {
      const currentPrice = priceMap[trade.symbol];
      if (!currentPrice) continue;

      const t = trade as any;
      const effectiveSL: number = t.effectiveSL ?? trade.stopLoss;
      const isLong = trade.positionType === 'Long';

      // Check SL first
      const slHit = isLong
        ? currentPrice <= effectiveSL
        : currentPrice >= effectiveSL;

      if (slHit) {
        await handleSLHit(trade, currentPrice);
        continue;
      }

      // Check TPs in order
      if (!t.tp3Executed && t.tp2Executed) {
        const tp3Hit = isLong ? currentPrice >= trade.tp3 : currentPrice <= trade.tp3;
        if (tp3Hit) {
          await handleTPHit(trade, 3, currentPrice);
          continue;
        }
      }

      if (!t.tp2Executed && t.tp1Executed) {
        const tp2Hit = isLong ? currentPrice >= trade.tp2 : currentPrice <= trade.tp2;
        if (tp2Hit) {
          await handleTPHit(trade, 2, currentPrice);
          continue;
        }
      }

      if (!t.tp1Executed) {
        const tp1Hit = isLong ? currentPrice >= trade.tp1 : currentPrice <= trade.tp1;
        if (tp1Hit) {
          await handleTPHit(trade, 1, currentPrice);
          continue;
        }
      }

      // Reversal detection using the correct signature: (symbol, entryPrice, positionType, modality)
      try {
        const reversal = await detectMarketReversal(
          trade.symbol,
          trade.entryPrice,
          trade.positionType,
          trade.modality
        );

        if (reversal?.detectedReversal && reversal.confidence >= 80) {
          const liveEnabled = isLiveTradingEnabled();
          const modalityOrders = getModalityLiveOrders();
          const modalityLive = modalityOrders[trade.modality] ?? false;
          const shouldPlaceLiveOrders = liveEnabled && modalityLive;
          const credentials = getCredentials();
          const qty = getTradeQuantity(trade);
          const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';

          if (shouldPlaceLiveOrders && credentials && qty > 0) {
            try {
              await withTimeout(
                placeMarketOrder({
                  symbol: trade.symbol,
                  side: closeSide,
                  quantity: qty,
                  credentials,
                }),
                10000
              );
            } catch {
              // non-fatal
            }
          }

          const pnl = isLong
            ? (currentPrice - trade.entryPrice) * qty
            : (trade.entryPrice - currentPrice) * qty;

          saveRecord({
            id: `${trade.id}-reversal`,
            symbol: trade.symbol,
            modality: trade.modality,
            positionType: trade.positionType,
            entryPrice: trade.entryPrice,
            exitPrice: currentPrice,
            investment: trade.investmentAmount,
            pnlUsd: pnl,
            pnlPercent: trade.investmentAmount > 0 ? (pnl / trade.investmentAmount) * 100 : 0,
            outcome: (pnl >= 0 ? 'TP Hit' : 'SL Hit') as 'TP Hit' | 'SL Hit',
            timestamp: Date.now(),
            outcomeNote: 'Closed by reversal detection',
          });

          const allTrades = getTrades();
          const idx = allTrades.findIndex(t2 => t2.id === trade.id);
          if (idx !== -1) {
            (allTrades[idx] as any).status = 'SLHit';
            persistTrades(allTrades);
          }

          toast.warning(`Reversão detectada para ${trade.symbol} — posição fechada`);

          window.dispatchEvent(
            new CustomEvent('ai-trade-regenerate', {
              detail: { modality: trade.modality },
            })
          );
        }
      } catch {
        // reversal detection failure is non-fatal
      }
    }
  }, [trades, handleTPHit, handleSLHit, getTrades, persistTrades, saveRecord]);

  useEffect(() => {
    if (!trades || trades.length === 0) return;

    checkPrices();
    intervalRef.current = setInterval(checkPrices, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [trades, checkPrices]);
}
