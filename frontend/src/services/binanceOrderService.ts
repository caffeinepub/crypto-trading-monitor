import { BinanceCredentials, getCredentials } from '@/utils/liveTradingStorage';

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  stopPrice?: number;
  credentials?: BinanceCredentials;
}

export interface BinanceOrderResponse {
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  executedQty: string;
  clientOrderId: string;
}

export interface BinanceOpenOrder {
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  stopPrice: string;
  clientOrderId: string;
}

const BASE_URL = 'https://fapi.binance.com';

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function signedRequest(
  endpoint: string,
  params: Record<string, string | number>,
  credentials: BinanceCredentials,
  method: 'GET' | 'POST' | 'DELETE' = 'POST'
): Promise<Response> {
  const timestamp = Date.now();
  const allParams = { ...params, timestamp };
  const queryString = Object.entries(allParams)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  // Support both apiSecret and secretKey field names
  const secret = (credentials as any).apiSecret || (credentials as any).secretKey || '';
  const signature = await hmacSHA256(secret, queryString);
  const fullQuery = `${queryString}&signature=${signature}`;

  const url =
    method === 'GET' || method === 'DELETE'
      ? `${BASE_URL}${endpoint}?${fullQuery}`
      : `${BASE_URL}${endpoint}`;

  const body = method === 'POST' ? fullQuery : undefined;

  return fetch(url, {
    method,
    headers: {
      'X-MBX-APIKEY': credentials.apiKey,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
}

export async function placeMarketOrder(
  params: OrderParams
): Promise<BinanceOrderResponse> {
  const credentials = params.credentials || getCredentials();
  if (!credentials) throw new Error('No Binance credentials configured');

  const orderParams: Record<string, string | number> = {
    symbol: params.symbol,
    side: params.side,
    type: 'MARKET',
    quantity: params.quantity,
  };

  const response = await withTimeout(
    signedRequest('/fapi/v1/order', orderParams, credentials),
    15000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function placeLimitOrder(
  params: OrderParams
): Promise<BinanceOrderResponse> {
  const credentials = params.credentials || getCredentials();
  if (!credentials) throw new Error('No Binance credentials configured');
  if (!params.price) throw new Error('Price required for limit order');

  const orderParams: Record<string, string | number> = {
    symbol: params.symbol,
    side: params.side,
    type: 'LIMIT',
    quantity: params.quantity,
    price: params.price,
    timeInForce: 'GTC',
  };

  const response = await withTimeout(
    signedRequest('/fapi/v1/order', orderParams, credentials),
    15000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function placeTakeProfitMarketOrder(
  params: OrderParams
): Promise<BinanceOrderResponse> {
  const credentials = params.credentials || getCredentials();
  if (!credentials) throw new Error('No Binance credentials configured');
  if (!params.stopPrice) throw new Error('stopPrice required for take profit order');

  const orderParams: Record<string, string | number> = {
    symbol: params.symbol,
    side: params.side,
    type: 'TAKE_PROFIT_MARKET',
    quantity: params.quantity,
    stopPrice: params.stopPrice,
    closePosition: 'false',
  };

  const response = await withTimeout(
    signedRequest('/fapi/v1/order', orderParams, credentials),
    15000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function placeTakeProfitOrder(
  params: OrderParams
): Promise<BinanceOrderResponse> {
  return placeTakeProfitMarketOrder(params);
}

export async function placeStopLossOrder(
  params: OrderParams
): Promise<BinanceOrderResponse> {
  const credentials = params.credentials || getCredentials();
  if (!credentials) throw new Error('No Binance credentials configured');
  if (!params.stopPrice) throw new Error('stopPrice required for stop loss order');

  const orderParams: Record<string, string | number> = {
    symbol: params.symbol,
    side: params.side,
    type: 'STOP_MARKET',
    quantity: params.quantity,
    stopPrice: params.stopPrice,
    closePosition: 'false',
  };

  const response = await withTimeout(
    signedRequest('/fapi/v1/order', orderParams, credentials),
    15000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function cancelOrder(
  symbol: string,
  orderId: number,
  credentials?: BinanceCredentials
): Promise<BinanceOrderResponse> {
  const creds = credentials || getCredentials();
  if (!creds) throw new Error('No Binance credentials configured');

  const response = await withTimeout(
    signedRequest('/fapi/v1/order', { symbol, orderId }, creds, 'DELETE'),
    10000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getOpenOrders(
  symbol: string,
  credentials?: BinanceCredentials
): Promise<BinanceOpenOrder[]> {
  const creds = credentials || getCredentials();
  if (!creds) throw new Error('No Binance credentials configured');

  const response = await withTimeout(
    signedRequest('/fapi/v1/openOrders', { symbol }, creds, 'GET'),
    10000
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.msg || `HTTP ${response.status}`);
  }

  return response.json();
}
