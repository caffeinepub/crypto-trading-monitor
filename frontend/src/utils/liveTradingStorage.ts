/**
 * liveTradingStorage.ts
 * Manages live trading mode and Binance credentials in localStorage.
 * All window event dispatches are deferred via setTimeout(0) to prevent
 * synchronous re-render cascades and infinite loops.
 *
 * Custom DOM events dispatched:
 *   - 'live-trading-change': when live trading is enabled/disabled
 *   - 'credential-change': when credentials are saved or cleared
 *   (Legacy names 'liveTradingChanged' and 'credentialsChanged' are also dispatched for backward compatibility)
 */

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

export function setLiveTradingEnabled(value: boolean): void {
  try {
    localStorage.setItem(LIVE_TRADING_KEY, value ? 'true' : 'false');
    // Defer event dispatch to prevent synchronous re-render cascades
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('live-trading-change'));
      window.dispatchEvent(new CustomEvent('liveTradingChanged')); // legacy
    }, 0);
  } catch {
    // Ignore storage errors
  }
}

export function getCredentials(): BinanceCredentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BinanceCredentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: BinanceCredentials): void {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    // Defer event dispatch to prevent synchronous re-render cascades
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('credential-change'));
      window.dispatchEvent(new CustomEvent('credentialsChanged')); // legacy
    }, 0);
  } catch {
    // Ignore storage errors
  }
}

export function clearCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_KEY);
    // Defer event dispatch to prevent synchronous re-render cascades
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('credential-change'));
      window.dispatchEvent(new CustomEvent('credentialsChanged')); // legacy
    }, 0);
  } catch {
    // Ignore storage errors
  }
}

export function hasCredentials(): boolean {
  const creds = getCredentials();
  return !!(creds && creds.apiKey && creds.apiSecret);
}

// ── Legacy aliases kept for backward compatibility ──────────────────────────

/** @deprecated Use getCredentials() instead */
export function getBinanceCredentials(): BinanceCredentials | null {
  return getCredentials();
}

/** @deprecated Use hasCredentials() instead */
export function hasValidCredentials(): boolean {
  return hasCredentials();
}

/** @deprecated Use saveCredentials() instead */
export function setBinanceCredentials(creds: BinanceCredentials): void {
  saveCredentials(creds);
}

/** @deprecated Use clearCredentials() instead */
export function clearBinanceCredentials(): void {
  clearCredentials();
}

export function isLiveTradingReady(): boolean {
  return isLiveTradingEnabled() && hasCredentials();
}
