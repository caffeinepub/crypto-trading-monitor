/**
 * binanceAuth.ts
 * Authenticated Binance API utility with HMAC-SHA256 signing.
 * Applies a named BINANCE_REQUEST_TIMEOUT_MS = 15000 AbortController timeout
 * to every authenticatedFetch call, merges caller-provided signals, and throws
 * a BinanceApiError with code REQUEST_TIMEOUT on timeout so no request can
 * hang the UI indefinitely.
 */

import { BinanceCredentials } from './liveTradingStorage';

// Named constant for request timeout
const BINANCE_REQUEST_TIMEOUT_MS = 15000;

export class BinanceApiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'BinanceApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Signs a query string with HMAC-SHA256 using the provided secret.
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

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Makes an authenticated request to the Binance API with HMAC-SHA256 signing.
 * Applies a 15-second internal timeout. Combines with any caller-provided signal.
 * Throws BinanceApiError with code 'REQUEST_TIMEOUT' on timeout.
 * Always clears the internal timeout in a finally block to prevent memory leaks.
 */
export async function authenticatedFetch(
  url: string,
  credentials: BinanceCredentials,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<Response> {
  // Internal 15-second timeout controller
  const internalController = new AbortController();
  const timeoutId = setTimeout(() => internalController.abort(), BINANCE_REQUEST_TIMEOUT_MS);

  // Combine internal timeout with any caller-provided signal
  let combinedSignal: AbortSignal;
  if (options.signal) {
    // Create a combined controller that aborts when either signal fires
    const combinedController = new AbortController();

    const abortCombined = () => combinedController.abort();
    internalController.signal.addEventListener('abort', abortCombined, { once: true });
    options.signal.addEventListener('abort', abortCombined, { once: true });

    combinedSignal = combinedController.signal;
  } else {
    combinedSignal = internalController.signal;
  }

  // Build signed URL — add timestamp and signature as query params
  const urlObj = new URL(url);
  const timestamp = Date.now();
  urlObj.searchParams.set('timestamp', timestamp.toString());

  const queryString = urlObj.searchParams.toString();
  const signature = await signQuery(queryString, credentials.apiSecret);
  urlObj.searchParams.set('signature', signature);

  try {
    const response = await fetch(urlObj.toString(), {
      ...options,
      signal: combinedSignal,
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    return response;
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');

    if (isAbort) {
      throw new BinanceApiError(
        'Request timed out after 15 seconds',
        'REQUEST_TIMEOUT'
      );
    }

    throw err;
  } finally {
    // Always clear the internal timeout to prevent memory leaks
    clearTimeout(timeoutId);
  }
}

/**
 * Checks if credentials are present in localStorage.
 */
export function hasCredentials(): boolean {
  try {
    const raw = localStorage.getItem('binance_credentials');
    if (!raw) return false;
    const creds = JSON.parse(raw);
    return !!(creds && creds.apiKey && creds.apiSecret);
  } catch {
    return false;
  }
}
