import { AITradeRecord } from '@/types/tradeHistory';

const STORAGE_KEY = 'ai_trade_history';

export function getAITradeHistory(): AITradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAITradeRecord(record: AITradeRecord): void {
  try {
    const history = getAITradeHistory();
    // Prevent duplicates by id + outcome
    const exists = history.some(
      h => h.id === record.id && h.outcome === record.outcome
    );
    if (exists) return;
    history.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 500)));
  } catch {
    // non-fatal
  }
}

// Alias for backward compatibility
export const saveAITradeRecord = addAITradeRecord;

export function clearAITradeHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
