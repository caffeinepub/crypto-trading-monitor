import { UserTradeRecord } from '../types/tradeHistory';

const USER_HISTORY_KEY = 'user_trade_history';

export function getUserTradeHistory(): UserTradeRecord[] {
  try {
    const raw = localStorage.getItem(USER_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserTradeRecord[];
  } catch {
    return [];
  }
}

export function saveUserTrade(record: UserTradeRecord): void {
  try {
    const existing = getUserTradeHistory();
    existing.push(record);
    localStorage.setItem(USER_HISTORY_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Error saving user trade history:', err);
  }
}

export function clearUserTradeHistory(): void {
  try {
    localStorage.removeItem(USER_HISTORY_KEY);
  } catch (err) {
    console.error('Error clearing user trade history:', err);
  }
}
