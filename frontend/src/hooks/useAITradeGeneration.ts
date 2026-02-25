import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AITrade, TradingModality } from '@/types/aiTrade';
import { generateAITradeForModality } from '@/utils/aiTradeSelection';
import { useAITradeStorage } from '@/hooks/useAITradeStorage';
import {
  isLiveTradingEnabled,
  getModalityLiveOrders,
  getCredentials,
} from '@/utils/liveTradingStorage';
import {
  placeMarketOrder,
  placeStopLossOrder,
  placeTakeProfitMarketOrder,
  OrderParams,
} from '@/services/binanceOrderService';
import { getTotalCapital } from '@/utils/totalCapitalStorage';

const MODALITIES: TradingModality[] = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function placeLiveOrdersForTrade(trade: AITrade): Promise<void> {
  const liveEnabled = isLiveTradingEnabled();
  const modalityOrders = getModalityLiveOrders();
  const credentials = getCredentials();

  if (!liveEnabled || !credentials) return;
  if (!(modalityOrders[trade.modality] ?? false)) return;

  const isLong = trade.positionType === 'Long';
  const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';
  const qty: number =
    (trade as any).quantity ??
    (trade.investmentAmount && trade.entryPrice
      ? trade.investmentAmount / trade.entryPrice
      : 0);

  if (qty <= 0) return;

  const orderBase: OrderParams = {
    symbol: trade.symbol,
    side: closeSide,
    quantity: qty,
    credentials,
  };

  // Entry market order
  try {
    await withTimeout(
      placeMarketOrder({
        symbol: trade.symbol,
        side: isLong ? 'BUY' : 'SELL',
        quantity: qty,
        credentials,
      }),
      10000
    );
  } catch {
    // non-fatal
  }

  // TP orders
  for (const tpPrice of [trade.tp1, trade.tp2, trade.tp3]) {
    if (!tpPrice) continue;
    try {
      await withTimeout(
        placeTakeProfitMarketOrder({ ...orderBase, stopPrice: tpPrice }),
        10000
      );
    } catch {
      // non-fatal
    }
  }

  // SL order
  if (trade.stopLoss) {
    try {
      await withTimeout(
        placeStopLossOrder({ ...orderBase, stopPrice: trade.stopLoss }),
        10000
      );
    } catch {
      // non-fatal
    }
  }
}

export function useAITradeGeneration() {
  const { getTrades, saveTrades, checkAndResetDaily } = useAITradeStorage();
  const queryClient = useQueryClient();

  const generateTrades = useCallback(async (): Promise<AITrade[]> => {
    // Check if we need to reset daily
    checkAndResetDaily();

    const existingTrades = getTrades();

    // Only generate for modalities that don't have an active trade
    const existingModalities = new Set(
      existingTrades
        .filter(t => {
          const status = (t as any).status as string | undefined;
          return !status || status === 'Open' || status === 'active' || status === 'open';
        })
        .map(t => t.modality)
    );

    const totalCapital = getTotalCapital() ?? 1000;
    const investmentPerModality = Math.max(totalCapital * 0.1, 100);

    const newTrades: AITrade[] = [];

    for (const modality of MODALITIES) {
      if (existingModalities.has(modality)) continue;

      try {
        const trade = await generateAITradeForModality(modality, investmentPerModality);
        if (trade) {
          newTrades.push(trade);
        }
      } catch {
        // non-fatal — skip this modality
      }
    }

    if (newTrades.length === 0) return existingTrades;

    const allTrades = [...existingTrades, ...newTrades];
    saveTrades(allTrades);

    // Place live orders asynchronously — never blocks trade persistence
    for (const trade of newTrades) {
      placeLiveOrdersForTrade(trade).catch(() => {
        // non-fatal
      });
    }

    return allTrades;
  }, [getTrades, saveTrades, checkAndResetDaily]);

  const query = useQuery({
    queryKey: ['ai-trades'],
    queryFn: generateTrades,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const regenerateForModality = useCallback(
    async (modality: TradingModality): Promise<void> => {
      const existingTrades = getTrades();
      const filtered = existingTrades.filter(t => t.modality !== modality);

      const totalCapital = getTotalCapital() ?? 1000;
      const investmentPerModality = Math.max(totalCapital * 0.1, 100);

      try {
        const newTrade = await generateAITradeForModality(modality, investmentPerModality);
        if (newTrade) {
          const updated = [...filtered, newTrade];
          saveTrades(updated);
          placeLiveOrdersForTrade(newTrade).catch(() => {
            // non-fatal
          });
        }
      } catch {
        // non-fatal
      }

      queryClient.invalidateQueries({ queryKey: ['ai-trades'] });
    },
    [getTrades, saveTrades, queryClient]
  );

  return {
    ...query,
    regenerateForModality,
  };
}
