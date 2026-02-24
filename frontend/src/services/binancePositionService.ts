/**
 * Binance Futures open-position import service.
 *
 * Fetches all open positions from the Binance USD-M Futures account
 * (/fapi/v2/positionRisk) and maps them to the app's internal Position type.
 */

import { getCredentials, hasCredentials } from '../utils/liveTradingStorage';
import { BinancePositionRisk } from '../types/binanceApi';
import { Position, StopLossRecommendation, TakeProfitLevel } from '../types/position';

const FAPI_BASE = 'https://fapi.binance.com';
const POSITION_RISK_ENDPOINT = '/fapi/v2/positionRisk';
const REQUEST_TIMEOUT_MS = 15_000;

// ─── HMAC-SHA256 signing (Web Crypto API) ────────────────────────────────────

async function signQuery(queryString: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(queryString));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Minimal placeholder TP/SL so the Position type is satisfied ─────────────

function buildPlaceholderTP(entryPrice: number, positionType: 'Long' | 'Short'): TakeProfitLevel[] {
  const dir = positionType === 'Long' ? 1 : -1;
  return [
    { level: 1, price: entryPrice * (1 + dir * 0.02), profitUSD: 0, profitPercent: 2, reasoning: 'Imported from Binance' },
    { level: 2, price: entryPrice * (1 + dir * 0.04), profitUSD: 0, profitPercent: 4, reasoning: 'Imported from Binance' },
    { level: 3, price: entryPrice * (1 + dir * 0.06), profitUSD: 0, profitPercent: 6, reasoning: 'Imported from Binance' },
  ];
}

function buildPlaceholderSL(entryPrice: number, positionType: 'Long' | 'Short'): StopLossRecommendation {
  const dir = positionType === 'Long' ? -1 : 1;
  return {
    price: entryPrice * (1 + dir * 0.02),
    lossUSD: 0,
    lossPercent: 2,
    capitalRiskPercent: 1,
    reasoning: 'Imported from Binance — please review',
    partialTakingStrategy: 'N/A',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches all open positions from Binance USD-M Futures and maps them to
 * the app's internal Position type.
 *
 * Throws a descriptive error if credentials are missing or the API call fails.
 */
export async function fetchOpenPositions(): Promise<Position[]> {
  if (!hasCredentials()) {
    throw new Error('Binance API credentials not configured');
  }

  const credentials = getCredentials()!;
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = await signQuery(queryString, credentials.apiSecret);
  const url = `${FAPI_BASE}${POSITION_RISK_ENDPOINT}?${queryString}&signature=${signature}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch open positions from Binance: ${msg}`);
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      errorMsg = (body as { msg?: string }).msg ?? errorMsg;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`Failed to fetch open positions from Binance: ${errorMsg}`);
  }

  const data: BinancePositionRisk[] = await response.json();

  // Filter to only positions with a non-zero positionAmt
  const openPositions = data.filter((p) => parseFloat(p.positionAmt) !== 0);

  return openPositions.map((p): Position => {
    const positionAmt = parseFloat(p.positionAmt);
    const entryPrice = parseFloat(p.entryPrice);
    const leverage = parseInt(p.leverage, 10) || 1;
    const positionType: 'Long' | 'Short' = positionAmt > 0 ? 'Long' : 'Short';
    const absAmt = Math.abs(positionAmt);
    // investment = notional / leverage  (margin used)
    const investment = (absAmt * entryPrice) / leverage;
    const totalExposure = absAmt * entryPrice;

    return {
      id: `binance-import-${p.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: p.symbol,
      positionType,
      leverage,
      entryPrice,
      investmentAmount: investment,
      totalExposure,
      takeProfitLevels: buildPlaceholderTP(entryPrice, positionType),
      stopLoss: buildPlaceholderSL(entryPrice, positionType),
      timestamp: Date.now(),
    };
  });
}
