import { AITrade } from '../types/aiTrade';

const STORAGE_KEY = 'ai_daily_trades';

interface StoredData {
  utcDate?: string; // kept for backward compatibility, no longer used for invalidation
  trades: AITrade[];
}

/** Apply default values for new execution-state fields to maintain backward compatibility */
function applyDefaults(trade: AITrade): AITrade {
  return {
    ...trade,
    tp1Executed: trade.tp1Executed ?? false,
    tp2Executed: trade.tp2Executed ?? false,
    tp3Executed: trade.tp3Executed ?? false,
    effectiveSL: trade.effectiveSL ?? trade.stopLoss,
    riskManagementStep: trade.riskManagementStep ?? 'initial',
  };
}

export function useAITradeStorage() {
  const getTrades = (): AITrade[] | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data: StoredData = JSON.parse(raw);
      if (!data.trades || data.trades.length === 0) return null;
      return data.trades.map(applyDefaults);
    } catch {
      return null;
    }
  };

  const saveTrades = (trades: AITrade[]): void => {
    const data: StoredData = {
      trades,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const clearTrades = (): void => {
    localStorage.removeItem(STORAGE_KEY);
  };

  /**
   * Returns true only when no trades are stored at all (needs initial generation).
   * UTC date is no longer used for invalidation — trades persist until TP/SL/Reversal Guard closes them.
   */
  const checkAndResetDaily = (): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return true; // no trades stored, needs generation
      const data: StoredData = JSON.parse(raw);
      if (!data.trades || data.trades.length === 0) return true;
      return false; // trades exist, no reset needed
    } catch {
      return true;
    }
  };

  return { getTrades, saveTrades, clearTrades, checkAndResetDaily };
}
