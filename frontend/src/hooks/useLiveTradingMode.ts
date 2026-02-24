import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isLiveTradingEnabled,
  setLiveTradingEnabled,
  hasValidCredentials,
  isLiveTradingReady,
} from '../utils/liveTradingStorage';

export interface LiveTradingState {
  isLiveMode: boolean;
  isReady: boolean;
  hasCredentials: boolean;
  isValidating: boolean;
  toggleLiveTrading: (enabled: boolean) => Promise<void>;
}

export function useLiveTradingMode(): LiveTradingState {
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => isLiveTradingEnabled());
  const [hasCredentials, setHasCredentials] = useState<boolean>(() => hasValidCredentials());
  const [isValidating, setIsValidating] = useState(false);
  // Use a ref to track if we're currently toggling to prevent re-entrant calls
  const isTogglingRef = useRef(false);

  // Stable refresh function that reads from localStorage directly
  // Using useRef to keep a stable reference that never changes
  const refreshStateRef = useRef(() => {
    setIsLiveMode(isLiveTradingEnabled());
    setHasCredentials(hasValidCredentials());
  });

  // Register event listeners once on mount, never re-register
  useEffect(() => {
    const handleLiveTradingChanged = () => {
      refreshStateRef.current();
    };
    const handleCredentialsChanged = () => {
      refreshStateRef.current();
    };

    window.addEventListener('liveTradingChanged', handleLiveTradingChanged);
    window.addEventListener('credentialsChanged', handleCredentialsChanged);

    return () => {
      window.removeEventListener('liveTradingChanged', handleLiveTradingChanged);
      window.removeEventListener('credentialsChanged', handleCredentialsChanged);
    };
  }, []); // empty deps — register once, never re-register

  const toggleLiveTrading = useCallback(async (enabled: boolean) => {
    // Prevent re-entrant calls
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setIsValidating(true);

    try {
      if (enabled) {
        // Validate credentials asynchronously before enabling
        const credentialsValid = hasValidCredentials();
        if (!credentialsValid) {
          // Don't enable live trading without credentials
          setIsValidating(false);
          isTogglingRef.current = false;
          throw new Error('No valid Binance credentials found. Please configure your API keys first.');
        }
      }

      // Write to localStorage (event dispatch is deferred via setTimeout in storage util)
      setLiveTradingEnabled(enabled);

      // Update local state immediately without waiting for the event
      setIsLiveMode(enabled);
      setHasCredentials(hasValidCredentials());
    } finally {
      setIsValidating(false);
      isTogglingRef.current = false;
    }
  }, []); // stable — no deps that change

  const isReady = isLiveMode && hasCredentials;

  return {
    isLiveMode,
    isReady,
    hasCredentials,
    isValidating,
    toggleLiveTrading,
  };
}
