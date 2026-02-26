import { memo, useEffect, useRef, useState } from 'react';
import { hasCredentials } from '../utils/credentialsStorage';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const CredentialStatusIndicator = memo(function CredentialStatusIndicator() {
  const [connected, setConnected] = useState<boolean>(() => hasCredentials());

  const handlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    handlerRef.current = () => {
      setConnected(hasCredentials());
    };
    const handler = () => handlerRef.current();
    window.addEventListener('credential-change', handler);
    return () => window.removeEventListener('credential-change', handler);
  }, []);

  if (connected) {
    return (
      <Badge className="gap-1 bg-chart-1/20 text-chart-1 border border-chart-1/40 hover:bg-chart-1/20">
        <CheckCircle className="h-3 w-3" />
        API Connected
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-warning/60 text-warning hover:bg-warning/10">
      <AlertCircle className="h-3 w-3" />
      No API Key
    </Badge>
  );
});

export default CredentialStatusIndicator;
