import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  isLiveTradingEnabled,
  setLiveTradingEnabled,
  getCredentials,
} from '../utils/liveTradingStorage';
import { authenticatedFetch } from '../utils/binanceAuth';

// Named constant for credential validation timeout
const CREDENTIAL_VALIDATION_TIMEOUT_MS = 15000;

export function useLiveTradingMode() {
  const [isLiveTrading, setIsLiveTrading] = useState<boolean>(() => isLiveTradingEnabled());

  // Use a ref for the event handler to avoid re-registering on every render
  const handlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Register the live-trading-change listener exactly once
    const handler = () => {
      setIsLiveTrading(isLiveTradingEnabled());
    };
    handlerRef.current = handler;

    window.addEventListener('live-trading-change', handler);
    // Also listen to legacy event name for backward compatibility
    window.addEventListener('liveTradingChanged', handler);

    return () => {
      window.removeEventListener('live-trading-change', handler);
      window.removeEventListener('liveTradingChanged', handler);
    };
  }, []); // Empty dependency array — register once only

  const validateCredentials = useCallback(async (): Promise<boolean> => {
    const creds = getCredentials();
    if (!creds) {
      toast.error('Configure suas credenciais da Binance antes de ativar o Live Trading.');
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CREDENTIAL_VALIDATION_TIMEOUT_MS);

    try {
      const response = await authenticatedFetch(
        'https://fapi.binance.com/fapi/v2/account',
        creds,
        { signal: controller.signal }
      );

      if (response.ok) {
        return true;
      } else if (response.status === 401 || response.status === 403) {
        toast.error('Credenciais inválidas. Verifique sua API Key e Secret.');
        return false;
      } else {
        toast.warning(`Aviso: servidor retornou HTTP ${response.status}. Ativando mesmo assim.`);
        return true;
      }
    } catch (err: unknown) {
      const isTimeout =
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'REQUEST_TIMEOUT');

      if (isTimeout) {
        // On timeout, still activate but warn the user
        toast.warning(
          'Verificação de credenciais expirou — Live Trading ativado sem verificação completa.',
          { duration: 6000 }
        );
        return true;
      }

      // Network or other error — still activate with warning
      toast.warning('Não foi possível verificar credenciais. Ativando Live Trading mesmo assim.');
      return true;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const toggleLiveTrading = useCallback(async (forceValue?: boolean): Promise<void> => {
    const newValue = forceValue !== undefined ? forceValue : !isLiveTradingEnabled();

    if (!newValue) {
      // Disabling — instant, no async validation
      setLiveTradingEnabled(false);
      setIsLiveTrading(false);
      toast.info('Live Trading desativado.');
      return;
    }

    // Enabling — validate credentials first (with timeout)
    const isValid = await validateCredentials();

    if (isValid) {
      setLiveTradingEnabled(true);
      setIsLiveTrading(true);
      toast.success('Live Trading ativado! Ordens serão enviadas à Binance Futures.');
    }
    // If not valid, validateCredentials already showed the error toast
  }, [validateCredentials]);

  return {
    isLiveTrading,
    toggleLiveTrading,
  };
}
