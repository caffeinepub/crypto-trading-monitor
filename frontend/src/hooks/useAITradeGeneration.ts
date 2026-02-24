import { useQuery } from '@tanstack/react-query';
import { AITrade, TradingModality } from '../types/aiTrade';
import { useAITradeStorage } from './useAITradeStorage';
import { generateAITradeForModality } from '../utils/aiTradeSelection';
import { getTotalCapital } from '../utils/totalCapitalStorage';
import { isLiveTradingEnabled, getCredentials } from '../utils/liveTradingStorage';
import {
  placeMarketOrder,
  placeTakeProfitOrder,
  placeStopLossOrder,
  OrderParams,
} from '../services/binanceOrderService';
import { toast } from 'sonner';

const MODALITIES: TradingModality[] = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];
const DEFAULT_INVESTMENT_PER_MODALITY = 1000;

/** Timeout for each individual Binance order call triggered by AI trade generation (10 seconds). */
const ORDER_CALL_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT:${label}`)), ms)
    ),
  ]);
}

/**
 * Places live Binance orders for an AI-generated trade.
 * Each order call has an independent 10-second timeout.
 * Failures are caught individually and toasted — they never block trade persistence.
 */
async function placeAITradeOrders(trade: AITrade): Promise<void> {
  if (!isLiveTradingEnabled()) return;

  const creds = getCredentials();
  if (!creds) {
    toast.warning('Live Trading ativo mas sem credenciais — trade salvo localmente apenas.');
    return;
  }

  const symbol = trade.symbol.replace('/', '').replace('-', '');
  const side: 'BUY' | 'SELL' = trade.positionType === 'Long' ? 'BUY' : 'SELL';
  const closeSide: 'BUY' | 'SELL' = trade.positionType === 'Long' ? 'SELL' : 'BUY';
  // Quantity = investmentAmount / entryPrice (number of contracts)
  const quantity = parseFloat((trade.investmentAmount / trade.entryPrice).toFixed(3));

  // 1. Market entry order
  const entryParams: OrderParams = { symbol, side, quantity, credentials: creds };
  try {
    await withTimeout(
      placeMarketOrder(entryParams),
      ORDER_CALL_TIMEOUT_MS,
      'ai-entry'
    );
    toast.success(`AI Trade: ordem de entrada enviada à Binance: ${symbol}`);
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
    if (isTimeout) {
      toast.warning(`AI Trade: ordem de entrada expirou — ${symbol} salvo localmente apenas.`);
    } else {
      toast.error(`AI Trade: falha na ordem de entrada ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }

  // 2. Take-profit order — use tp1 as the primary TP level
  if (trade.tp1) {
    const tpParams: OrderParams = {
      symbol,
      side: closeSide,
      quantity,
      credentials: creds,
      stopPrice: trade.tp1,
      reduceOnly: true,
    };
    try {
      await withTimeout(
        placeTakeProfitOrder(tpParams),
        ORDER_CALL_TIMEOUT_MS,
        'ai-tp'
      );
      toast.success(`AI Trade: ordem TP enviada à Binance: ${symbol}`);
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
      if (isTimeout) {
        toast.warning(`AI Trade: ordem TP expirou — ${symbol} sem TP na Binance.`);
      } else {
        toast.error(`AI Trade: falha na ordem TP ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  }

  // 3. Stop-loss order — AITrade uses stopLoss (number)
  if (trade.stopLoss) {
    const slParams: OrderParams = {
      symbol,
      side: closeSide,
      quantity,
      credentials: creds,
      stopPrice: trade.stopLoss,
      reduceOnly: true,
    };
    try {
      await withTimeout(
        placeStopLossOrder(slParams),
        ORDER_CALL_TIMEOUT_MS,
        'ai-sl'
      );
      toast.success(`AI Trade: ordem SL enviada à Binance: ${symbol}`);
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message.startsWith('TIMEOUT:');
      if (isTimeout) {
        toast.warning(`AI Trade: ordem SL expirou — ${symbol} sem SL na Binance.`);
      } else {
        toast.error(`AI Trade: falha na ordem SL ${symbol}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }
  }
}

export function useAITradeGeneration() {
  const { getTrades, saveTrades, checkAndResetDaily } = useAITradeStorage();

  const rawCapital = getTotalCapital();
  const totalCapital = rawCapital !== null ? rawCapital : 0;
  const investmentPerModality =
    totalCapital > 0 ? totalCapital / 4 : DEFAULT_INVESTMENT_PER_MODALITY;

  return useQuery<AITrade[]>({
    queryKey: ['ai-daily-trades', totalCapital],
    queryFn: async () => {
      const needsGeneration = checkAndResetDaily();

      if (!needsGeneration) {
        const stored = getTrades();
        if (stored && stored.length > 0) return stored;
      }

      const trades: AITrade[] = [];
      for (const modality of MODALITIES) {
        try {
          const trade = await generateAITradeForModality(modality, investmentPerModality);
          if (trade) trades.push(trade);
        } catch (err) {
          console.error(`Failed to generate trade for ${modality}:`, err);
          // Skip failed modality — don't abort the whole generation
        }
      }

      if (trades.length === 0) {
        throw new Error('Failed to generate any AI trades. Please check your connection.');
      }

      // Always persist trades to localStorage first — before any order placement
      saveTrades(trades);

      // Place live orders asynchronously if live trading is active
      // Each order has an independent 10-second timeout and never blocks trade persistence
      if (isLiveTradingEnabled()) {
        for (const trade of trades) {
          placeAITradeOrders(trade).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`AI trade order placement error for ${trade.symbol}:`, msg);
          });
        }
      }

      return trades;
    },
    staleTime: Infinity, // trades persist until explicitly closed — no time-based staleness
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
