import { getCredentials, hasCredentials } from '../utils/credentialsStorage';

export interface OrderResult {
  orderId: string | number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: string;
  price?: string;
  stopPrice?: string;
  raw: unknown;
}

function getActor() {
  // Actor is accessed via dynamic import to avoid circular deps
  // We use the global actor stored by the app
  const actor = (window as unknown as { __binanceActor?: unknown }).__binanceActor;
  if (!actor) {
    throw new Error('Backend actor not initialized. Please wait and try again.');
  }
  return actor as {
    placeMarketOrder: (apiKey: string, apiSecret: string, symbol: string, side: string, quantity: string) => Promise<{ status: string; message: string }>;
    placeLimitOrder: (apiKey: string, apiSecret: string, symbol: string, side: string, quantity: string, price: string) => Promise<{ status: string; message: string }>;
    placeStopMarketOrder: (apiKey: string, apiSecret: string, symbol: string, side: string, quantity: string, stopPrice: string) => Promise<{ status: string; message: string }>;
    placeTakeProfitMarketOrder: (apiKey: string, apiSecret: string, symbol: string, side: string, quantity: string, stopPrice: string) => Promise<{ status: string; message: string }>;
    cancelOrder: (apiKey: string, apiSecret: string, symbol: string, orderId: string) => Promise<{ status: string; message: string }>;
  };
}

function requireCredentials(): { apiKey: string; apiSecret: string } {
  if (!hasCredentials()) {
    throw new Error('API credentials not configured. Please add your Binance API Key and Secret in Settings.');
  }
  return getCredentials();
}

function parseOrderResponse(message: string, symbol: string): OrderResult {
  try {
    const parsed = JSON.parse(message);
    if (parsed.code && parsed.code < 0) {
      throw new Error(`Binance error ${parsed.code}: ${parsed.msg}`);
    }
    return {
      orderId: parsed.orderId ?? parsed.clientOrderId ?? 'unknown',
      symbol: parsed.symbol ?? symbol,
      status: parsed.status ?? 'SUBMITTED',
      side: parsed.side ?? '',
      type: parsed.type ?? '',
      origQty: parsed.origQty ?? '',
      price: parsed.price,
      stopPrice: parsed.stopPrice,
      raw: parsed,
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return {
        orderId: 'unknown',
        symbol,
        status: 'SUBMITTED',
        side: '',
        type: '',
        origQty: '',
        raw: message,
      };
    }
    throw e;
  }
}

export async function placeMarketOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: string
): Promise<OrderResult> {
  const { apiKey, apiSecret } = requireCredentials();
  const actor = getActor();
  const result = await actor.placeMarketOrder(apiKey, apiSecret, symbol, side, quantity);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
  return parseOrderResponse(result.message, symbol);
}

export async function placeLimitOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: string,
  price: string
): Promise<OrderResult> {
  const { apiKey, apiSecret } = requireCredentials();
  const actor = getActor();
  const result = await actor.placeLimitOrder(apiKey, apiSecret, symbol, side, quantity, price);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
  return parseOrderResponse(result.message, symbol);
}

export async function placeStopMarketOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: string,
  stopPrice: string
): Promise<OrderResult> {
  const { apiKey, apiSecret } = requireCredentials();
  const actor = getActor();
  const result = await actor.placeStopMarketOrder(apiKey, apiSecret, symbol, side, quantity, stopPrice);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
  return parseOrderResponse(result.message, symbol);
}

export async function placeTakeProfitMarketOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: string,
  stopPrice: string
): Promise<OrderResult> {
  const { apiKey, apiSecret } = requireCredentials();
  const actor = getActor();
  const result = await actor.placeTakeProfitMarketOrder(apiKey, apiSecret, symbol, side, quantity, stopPrice);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
  return parseOrderResponse(result.message, symbol);
}

export async function cancelOrder(
  symbol: string,
  orderId: string
): Promise<OrderResult> {
  const { apiKey, apiSecret } = requireCredentials();
  const actor = getActor();
  const result = await actor.cancelOrder(apiKey, apiSecret, symbol, orderId);
  if (result.status === 'error') {
    throw new Error(result.message);
  }
  return parseOrderResponse(result.message, symbol);
}
