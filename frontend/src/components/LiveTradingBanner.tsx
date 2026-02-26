import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export const LiveTradingBanner = memo(function LiveTradingBanner() {
  const [isLive, setIsLive] = useState<boolean>(() => {
    return localStorage.getItem('live_trading_enabled') === 'true';
  });

  const handlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    handlerRef.current = () => {
      setIsLive(localStorage.getItem('live_trading_enabled') === 'true');
    };
    const handler = () => handlerRef.current();
    window.addEventListener('live-trading-change', handler);
    return () => window.removeEventListener('live-trading-change', handler);
  }, []);

  if (!isLive) return null;

  return (
    <div className="w-full bg-warning text-warning-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>LIVE TRADING ACTIVE — Real orders will be sent to Binance Futures</span>
      <AlertTriangle className="h-4 w-4 shrink-0" />
    </div>
  );
});

export default LiveTradingBanner;
