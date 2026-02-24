import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { isLiveTradingEnabled } from '../utils/liveTradingStorage';

export const LiveTradingBanner: React.FC = React.memo(() => {
  const [isLive, setIsLive] = useState<boolean>(() => isLiveTradingEnabled());
  // Use a ref for the handler so it never changes identity
  const handlerRef = useRef<() => void>(() => {
    setIsLive(isLiveTradingEnabled());
  });

  useEffect(() => {
    const handler = handlerRef.current;
    window.addEventListener('liveTradingChanged', handler);
    window.addEventListener('credentialsChanged', handler);
    return () => {
      window.removeEventListener('liveTradingChanged', handler);
      window.removeEventListener('credentialsChanged', handler);
    };
  }, []); // register once, never re-register

  if (!isLive) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-center gap-2">
      <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wide uppercase">
        Live Trading Active — Real orders will be placed on Binance Futures
      </span>
      <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
    </div>
  );
});

LiveTradingBanner.displayName = 'LiveTradingBanner';

export default LiveTradingBanner;
