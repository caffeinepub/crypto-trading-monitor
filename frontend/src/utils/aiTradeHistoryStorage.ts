import { AITradeRecord } from '../types/tradeHistory';

const AI_HISTORY_KEY = 'ai_trade_history';

export function getAITradeHistory(): AITradeRecord[] {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AITradeRecord[];
  } catch {
    return [];
  }
}

export function saveAITradeHistory(record: AITradeRecord): void {
  try {
    const existing = getAITradeHistory();
    // Avoid duplicate entries for the same trade id + outcome
    const alreadyExists = existing.some(
      (r) => r.id === record.id && r.outcome === record.outcome
    );
    if (alreadyExists) return;
    existing.push(record);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Error saving AI trade history:', err);
  }
}

export function clearAITradeHistory(): void {
  try {
    localStorage.removeItem(AI_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing AI trade history:', err);
  }
}
