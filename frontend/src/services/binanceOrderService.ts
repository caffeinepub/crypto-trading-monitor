// Binance Futures order placement service
// Targets the Binance USD-M Futures API: https://fapi.binance.com/fapi/v1/order

import { BinanceCredentials } from '../utils/liveTradingStorage';

const FUTURES_BASE = 'https://fapi.binance.com';
const ORDER_ENDPOINT = '/fapi/v1/order';
const REQUEST_TIMEOUT_MS = 15_000;

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  credentials: BinanceCredentials;
  stopPrice?: number;
  price?: number;
  reduceOnly?: boolean;
}

export interface BinanceOrderResponse {
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: string;
  price: string;
  stopPrice?: string;
  [key: string]: unknown;
}

// HMAC-SHA256 signing using Web Crypto API (available in all modern browsers)
async function signQuery(queryString: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(queryString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function placeOrder(
  type: 'MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP_MARKET',
  params: OrderParams
): Promise<BinanceOrderResponse> {
  const { symbol, side, quantity, credentials, stopPrice, reduceOnly } = params;
  const timestamp = Date.now();

  const queryParts: string[] = [
    `symbol=${encodeURIComponent(symbol)}`,
    `side=${side}`,
    `type=${type}`,
    `quantity=${quantity}`,
    `timestamp=${timestamp}`,
  ];

  if (type !== 'MARKET' && stopPrice !== undefined) {
    queryParts.push(`stopPrice=${stopPrice}`);
  }

  if (reduceOnly) {
    queryParts.push('reduceOnly=true');
  }

  const queryString = queryParts.join('&');
  const signature = await signQuery(queryString, credentials.apiSecret);
  const fullQuery = `${queryString}&signature=${signature}`;

  const url = `${FUTURES_BASE}${ORDER_ENDPOINT}?${fullQuery}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMsg = (errorBody as { msg?: string }).msg ?? errorMsg;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`Binance API error (${type}): ${errorMsg}`);
  }

  return response.json() as Promise<BinanceOrderResponse>;
}

export async function placeMarketOrder(params: OrderParams): Promise<BinanceOrderResponse> {
  return placeOrder('MARKET', params);
}

export async function placeTakeProfitOrder(params: OrderParams): Promise<BinanceOrderResponse> {
  return placeOrder('TAKE_PROFIT_MARKET', { ...params, reduceOnly: true });
}

export async function placeStopLossOrder(params: OrderParams): Promise<BinanceOrderResponse> {
  return placeOrder('STOP_MARKET', { ...params, reduceOnly: true });
}
