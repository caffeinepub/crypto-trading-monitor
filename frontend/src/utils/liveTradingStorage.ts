/**
 * liveTradingStorage.ts
 * Manages live trading mode, Binance credentials, and per-modality live order settings in localStorage.
 * All window event dispatches are deferred via setTimeout(0) to prevent
 * synchronous re-render cascades and infinite loops.
 *
 * Custom DOM events dispatched:
 *   - 'live-trading-change': when live trading is enabled/disabled
 *   - 'credential-change': when credentials are saved or cleared
 *   - 'modality-live-orders-change': when a per-modality toggle is changed
 *   (Legacy names 'liveTradingChanged' and 'credentialsChanged' are also dispatched for backward compatibility)
 */

import { TradingModality } from '../types/aiTrade';

const LIVE_TRADING_KEY = 'live_trading_enabled';
const CREDENTIALS_KEY = 'binance_credentials';
const MODALITY_LIVE_ORDERS_KEY = 'modality_live_orders';

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
}

export type ModalityLiveOrdersMap = Record<TradingModality, boolean>;

const DEFAULT_MODALITY_LIVE_ORDERS: ModalityLiveOrdersMap = {
  Scalping: false,
  DayTrading: false,
  SwingTrading: false,
  TrendFollowing: false,
};

// ── Live Trading Mode ──────────────────────────────────────────────────────────

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

// ── Credentials ───────────────────────────────────────────────────────────────

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

// ── Per-Modality Live Orders ──────────────────────────────────────────────────

/**
 * Returns the stored per-modality live orders map.
 * Defaults all modalities to false if nothing is stored or if JSON parsing fails.
 */
export function getModalityLiveOrders(): ModalityLiveOrdersMap {
  try {
    const raw = localStorage.getItem(MODALITY_LIVE_ORDERS_KEY);
    if (!raw) return { ...DEFAULT_MODALITY_LIVE_ORDERS };
    const parsed = JSON.parse(raw) as Partial<ModalityLiveOrdersMap>;
    return {
      ...DEFAULT_MODALITY_LIVE_ORDERS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_MODALITY_LIVE_ORDERS };
  }
}

/**
 * Updates the live order toggle for a specific modality and persists to localStorage.
 * Dispatches 'modality-live-orders-change' custom DOM event after writing.
 */
export function setModalityLiveOrder(modality: TradingModality, enabled: boolean): void {
  try {
    const current = getModalityLiveOrders();
    current[modality] = enabled;
    localStorage.setItem(MODALITY_LIVE_ORDERS_KEY, JSON.stringify(current));
    // Defer event dispatch to prevent synchronous re-render cascades
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('modality-live-orders-change', { detail: { modality, enabled } })
      );
    }, 0);
  } catch {
    // Ignore storage errors
  }
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
