const API_KEY_STORAGE_KEY = 'binance_api_key';
const API_SECRET_STORAGE_KEY = 'binance_api_secret';

export function saveCredentials(apiKey: string, apiSecret: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  localStorage.setItem(API_SECRET_STORAGE_KEY, apiSecret);
  window.dispatchEvent(new CustomEvent('credential-change'));
}

export function getCredentials(): { apiKey: string; apiSecret: string } {
  return {
    apiKey: localStorage.getItem(API_KEY_STORAGE_KEY) ?? '',
    apiSecret: localStorage.getItem(API_SECRET_STORAGE_KEY) ?? '',
  };
}

export function clearCredentials(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  localStorage.removeItem(API_SECRET_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('credential-change'));
}

export function hasCredentials(): boolean {
  const { apiKey, apiSecret } = getCredentials();
  return apiKey.trim().length > 0 && apiSecret.trim().length > 0;
}
