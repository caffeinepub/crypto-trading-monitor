import { BinanceCredentials, BinanceApiError } from '../types/binanceApi';

const API_KEY_STORAGE = 'binance_api_key';
const API_SECRET_STORAGE = 'binance_api_secret';

/**
 * Converts an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Signs a query string using HMAC-SHA256 with the provided secret.
 * Appends timestamp and signature to the query string.
 */
export async function signQuery(queryString: string, secret: string): Promise<string> {
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

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signature = bufferToHex(signatureBuffer);
  return `${queryString}&signature=${signature}`;
}

/**
 * Retrieves stored Binance credentials from localStorage.
 * Returns null if either key is missing.
 */
export function getStoredCredentials(): BinanceCredentials | null {
  const apiKey = localStorage.getItem(API_KEY_STORAGE);
  const secret = localStorage.getItem(API_SECRET_STORAGE);

  if (!apiKey || !secret || apiKey.trim() === '' || secret.trim() === '') {
    return null;
  }

  return { apiKey: apiKey.trim(), secret: secret.trim() };
}

/**
 * Returns true only when both API key and secret are stored and non-empty.
 */
export function hasCredentials(): boolean {
  return getStoredCredentials() !== null;
}

/**
 * Saves Binance credentials to localStorage and dispatches a custom event.
 */
export function saveCredentials(apiKey: string, secret: string): void {
  localStorage.setItem(API_KEY_STORAGE, apiKey.trim());
  localStorage.setItem(API_SECRET_STORAGE, secret.trim());
  window.dispatchEvent(new CustomEvent('credentialsChanged'));
}

/**
 * Clears Binance credentials from localStorage and dispatches a custom event.
 */
export function clearCredentials(): void {
  localStorage.removeItem(API_KEY_STORAGE);
  localStorage.removeItem(API_SECRET_STORAGE);
  window.dispatchEvent(new CustomEvent('credentialsChanged'));
}

/**
 * Makes an authenticated request to the Binance Futures API.
 * Attaches X-MBX-APIKEY header and signs the request with HMAC-SHA256.
 * Throws a BinanceApiError on non-200 responses.
 */
export async function authenticatedFetch(
  url: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  params: Record<string, string | number | boolean> = {}
): Promise<unknown> {
  const credentials = getStoredCredentials();
  if (!credentials) {
    const err: BinanceApiError = {
      code: -1,
      message: 'Binance API credentials not configured',
      status: 0,
    };
    throw err;
  }

  const timestamp = Date.now();
  const allParams = { ...params, timestamp };

  // Build query string from params
  const queryString = Object.entries(allParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  const signedQuery = await signQuery(queryString, credentials.secret);

  let fetchUrl = url;
  let body: string | undefined;

  if (method === 'GET' || method === 'DELETE') {
    fetchUrl = `${url}?${signedQuery}`;
  } else {
    body = signedQuery;
  }

  const response = await fetch(fetchUrl, {
    method,
    headers: {
      'X-MBX-APIKEY': credentials.apiKey,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    const err: BinanceApiError = {
      code: (data as { code?: number }).code ?? response.status,
      message: (data as { msg?: string }).msg ?? 'Unknown error',
      status: response.status,
    };
    throw err;
  }

  return data;
}
