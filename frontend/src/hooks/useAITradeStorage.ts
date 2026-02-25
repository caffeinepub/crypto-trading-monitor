import { useCallback } from 'react';
import { AITrade } from '@/types/aiTrade';

const STORAGE_KEY = 'ai_daily_trades';

function applyDefaults(trade: AITrade): AITrade {
  return {
    liveOrdersEnabled: false,
    ...trade,
  };
}

export function useAITradeStorage() {
  const getTrades = useCallback((): AITrade[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(applyDefaults) : [];
    } catch {
      return [];
    }
  }, []);

  const saveTrades = useCallback((trades: AITrade[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      window.dispatchEvent(new CustomEvent('ai-trades-changed'));
    } catch {
      // non-fatal
    }
  }, []);

  const clearTrades = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('ai-trades-changed'));
  }, []);

  const checkAndResetDaily = useCallback((): boolean => {
    try {
      const lastReset = localStorage.getItem('ai_trades_last_reset');
      const today = new Date().toDateString();
      if (lastReset !== today) {
        clearTrades();
        localStorage.setItem('ai_trades_last_reset', today);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [clearTrades]);

  return { getTrades, saveTrades, clearTrades, checkAndResetDaily };
}

// Standalone helpers for use outside of React components
export function getStoredTrades(): AITrade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(t => ({ liveOrdersEnabled: false, ...t })) : [];
  } catch {
    return [];
  }
}

export function storeTradesDirectly(trades: AITrade[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    window.dispatchEvent(new CustomEvent('ai-trades-changed'));
  } catch {
    // non-fatal
  }
}
