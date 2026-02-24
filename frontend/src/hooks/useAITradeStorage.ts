import { AITrade } from '../types/aiTrade';

const STORAGE_KEY = 'ai_daily_trades';

function getCurrentUTCDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

interface StoredData {
  utcDate: string;
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
      const today = getCurrentUTCDate();
      if (data.utcDate !== today) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data.trades.map(applyDefaults);
    } catch {
      return null;
    }
  };

  const saveTrades = (trades: AITrade[]): void => {
    const data: StoredData = {
      utcDate: getCurrentUTCDate(),
      trades,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const clearTrades = (): void => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const checkAndResetDaily = (): boolean => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return true; // needs generation
      const data: StoredData = JSON.parse(raw);
      const today = getCurrentUTCDate();
      if (data.utcDate !== today) {
        localStorage.removeItem(STORAGE_KEY);
        return true; // needs generation
      }
      return false; // trades are fresh
    } catch {
      return true;
    }
  };

  return { getTrades, saveTrades, clearTrades, checkAndResetDaily };
}
