import React, { useState, useEffect, useRef, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Key, Zap } from 'lucide-react';
import { hasCredentials, isLiveTradingEnabled } from '../utils/liveTradingStorage';

/**
 * CredentialStatusIndicator — shows API key validity and live mode badge.
 * Listens to 'credential-change' and 'live-trading-change' custom DOM events
 * to update reactively without page reload.
 * Event listeners are registered once on mount via useRef to prevent duplicate registration.
 */
export const CredentialStatusIndicator = memo(function CredentialStatusIndicator() {
  const [hasCreds, setHasCreds] = useState<boolean>(() => hasCredentials());
  const [isLive, setIsLive] = useState<boolean>(() => isLiveTradingEnabled());

  // Use stable refs for handlers to avoid re-registering on every render
  const credHandlerRef = useRef<(() => void) | null>(null);
  const liveHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const credHandler = () => {
      setHasCreds(hasCredentials());
    };
    const liveHandler = () => {
      setIsLive(isLiveTradingEnabled());
    };

    credHandlerRef.current = credHandler;
    liveHandlerRef.current = liveHandler;

    // Listen to credential changes (both event names for compatibility)
    window.addEventListener('credential-change', credHandler);
    window.addEventListener('credentialsChanged', credHandler);

    // Listen to live trading changes (both event names for compatibility)
    window.addEventListener('live-trading-change', liveHandler);
    window.addEventListener('liveTradingChanged', liveHandler);

    return () => {
      window.removeEventListener('credential-change', credHandler);
      window.removeEventListener('credentialsChanged', credHandler);
      window.removeEventListener('live-trading-change', liveHandler);
      window.removeEventListener('liveTradingChanged', liveHandler);
    };
  }, []); // Empty dependency array — register once only

  if (!hasCreds) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className="text-xs flex items-center gap-1 border-primary/30 text-primary/80 py-0.5"
      >
        <Key className="w-3 h-3" />
        API
      </Badge>
      {isLive && (
        <Badge className="text-xs flex items-center gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30 py-0.5">
          <Zap className="w-3 h-3" />
          LIVE
        </Badge>
      )}
    </div>
  );
});

export default CredentialStatusIndicator;
