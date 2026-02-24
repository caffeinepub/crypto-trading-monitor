// Live trading storage utility
// Manages live trading mode state in localStorage

const LIVE_TRADING_KEY = 'live_trading_enabled';
const CREDENTIALS_KEY = 'binance_credentials';

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

export function isLiveTradingEnabled(): boolean {
  try {
    return localStorage.getItem(LIVE_TRADING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLiveTradingEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(LIVE_TRADING_KEY, 'true');
    } else {
      localStorage.removeItem(LIVE_TRADING_KEY);
    }
    // Use setTimeout to defer the event dispatch to the next microtask,
    // preventing synchronous re-render cascades and infinite loops
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('liveTradingChanged', { detail: { enabled } }));
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore localStorage errors
  }
}

export function getBinanceCredentials(): BinanceCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.apiKey && parsed.apiSecret) {
      return parsed as BinanceCredentials;
    }
    return null;
  } catch {
    return null;
  }
}

export function setBinanceCredentials(credentials: BinanceCredentials): void {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('credentialsChanged', { detail: credentials }));
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}

export function clearBinanceCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY);
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('credentialsChanged', { detail: null }));
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}

export function hasValidCredentials(): boolean {
  const creds = getBinanceCredentials();
  return !!(creds && creds.apiKey && creds.apiKey.length > 10 && creds.apiSecret && creds.apiSecret.length > 10);
}

export function isLiveTradingReady(): boolean {
  return isLiveTradingEnabled() && hasValidCredentials();
}
