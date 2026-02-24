import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, KeyRound } from 'lucide-react';
import { hasValidCredentials, isLiveTradingEnabled } from '../utils/liveTradingStorage';

interface CredentialStatusIndicatorProps {
  onClick?: () => void;
}

export const CredentialStatusIndicator: React.FC<CredentialStatusIndicatorProps> = React.memo(({ onClick }) => {
  const [credentialsValid, setCredentialsValid] = useState<boolean>(() => hasValidCredentials());
  const [isLive, setIsLive] = useState<boolean>(() => isLiveTradingEnabled());

  // Stable handler ref — never changes identity, so the effect never re-runs
  const refreshRef = useRef(() => {
    setCredentialsValid(hasValidCredentials());
    setIsLive(isLiveTradingEnabled());
  });

  useEffect(() => {
    const handler = refreshRef.current;
    window.addEventListener('credentialsChanged', handler);
    window.addEventListener('liveTradingChanged', handler);
    return () => {
      window.removeEventListener('credentialsChanged', handler);
      window.removeEventListener('liveTradingChanged', handler);
    };
  }, []); // register once, never re-register

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
      title={credentialsValid ? 'Binance API credentials configured' : 'Configure Binance API credentials'}
    >
      <KeyRound className="h-4 w-4 text-muted-foreground" />
      {credentialsValid ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      )}
      {isLive && (
        <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">LIVE</span>
      )}
    </button>
  );
});

CredentialStatusIndicator.displayName = 'CredentialStatusIndicator';

export default CredentialStatusIndicator;
