import React, { useState, useEffect, useRef, memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isLiveTradingEnabled } from '../utils/liveTradingStorage';

/**
 * LiveTradingBanner — shows an amber warning strip when live trading is active.
 * Listens to 'live-trading-change' and 'liveTradingChanged' custom DOM events
 * to update reactively without page reload.
 * Event listener is registered once on mount via useRef to prevent re-render loops.
 */
export const LiveTradingBanner = memo(function LiveTradingBanner() {
  const [isLive, setIsLive] = useState<boolean>(() => isLiveTradingEnabled());

  // Use a stable ref for the handler to avoid re-registering on every render
  const handlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handler = () => {
      setIsLive(isLiveTradingEnabled());
    };
    handlerRef.current = handler;

    // Listen to both event names for compatibility
    window.addEventListener('live-trading-change', handler);
    window.addEventListener('liveTradingChanged', handler);

    return () => {
      window.removeEventListener('live-trading-change', handler);
      window.removeEventListener('liveTradingChanged', handler);
    };
  }, []); // Empty dependency array — register once only

  if (!isLive) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <p className="text-xs text-amber-300 font-medium">
          ⚡ LIVE TRADING ATIVO — Ordens reais estão sendo enviadas à Binance Futures
        </p>
      </div>
    </div>
  );
});

export default LiveTradingBanner;
