import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Save, Trash2, Wifi, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getCredentials, saveCredentials, clearCredentials } from '../utils/liveTradingStorage';
import { authenticatedFetch } from '../utils/binanceAuth';
import { fetchOpenPositions } from '../services/binancePositionService';
import { toast } from 'sonner';

// Named constant for test connection timeout
const CONNECTION_TEST_TIMEOUT_MS = 15000;

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'invalid' | 'timeout' | 'error';

export function BinanceCredentialsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [timeoutMessage, setTimeoutMessage] = useState('');

  // Load existing credentials on mount
  useEffect(() => {
    const creds = getCredentials();
    if (creds) {
      setApiKey(creds.apiKey || '');
      // Show masked secret if already saved
      setApiSecret(creds.apiSecret ? '••••••••••••••••' : '');
    }
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('API Key é obrigatória');
      return;
    }

    setIsSaving(true);
    try {
      // If secret is still masked, keep the existing secret
      const existing = getCredentials();
      const secretToSave =
        apiSecret === '••••••••••••••••' && existing
          ? existing.apiSecret
          : apiSecret.trim();

      if (!secretToSave) {
        toast.error('API Secret é obrigatório');
        return;
      }

      const newCreds = { apiKey: apiKey.trim(), apiSecret: secretToSave };
      saveCredentials(newCreds);
      // Dispatch credential-change event so all listeners update reactively
      window.dispatchEvent(new CustomEvent('credential-change'));
      setApiSecret('••••••••••••••••');

      // REQ-114: Trigger automatic position import after saving credentials
      try {
        const imported = await fetchOpenPositions();
        const count = imported.length;

        if (count > 0) {
          toast.success(`Credenciais salvas — ${count} posição(ões) importada(s) da Binance`);
        } else {
          toast.success('Credenciais salvas com sucesso. Nenhuma posição aberta encontrada.');
        }

        // Signal App.tsx to switch to Dashboard tab after import
        window.dispatchEvent(new CustomEvent('trigger-dashboard-switch'));
      } catch {
        // Credentials are saved even if import fails
        toast.success('Credenciais salvas com sucesso');
        toast.warning('Não foi possível importar posições automaticamente. Use o botão "Importar da Binance" no Dashboard.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    clearCredentials();
    setApiKey('');
    setApiSecret('');
    setConnectionStatus('idle');
    setTimeoutMessage('');
    // Dispatch credential-change event so all listeners update reactively
    window.dispatchEvent(new CustomEvent('credential-change'));
    toast.info('Credenciais removidas');
  };

  const handleTestConnection = async () => {
    const creds = getCredentials();
    if (!creds) {
      toast.error('Salve suas credenciais antes de testar');
      return;
    }

    setConnectionStatus('testing');
    setTimeoutMessage('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT_MS);

    try {
      const response = await authenticatedFetch(
        'https://fapi.binance.com/fapi/v2/account',
        creds,
        { signal: controller.signal }
      );

      if (response.ok) {
        setConnectionStatus('connected');
        toast.success('Conexão estabelecida com sucesso!');
      } else if (response.status === 401 || response.status === 403) {
        setConnectionStatus('invalid');
        toast.error('Credenciais inválidas');
      } else {
        setConnectionStatus('error');
        toast.error(`Erro ao conectar: HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      const isAbort =
        (err instanceof Error && err.name === 'AbortError') ||
        (typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'REQUEST_TIMEOUT');

      if (isAbort) {
        setConnectionStatus('timeout');
        setTimeoutMessage(
          'Tempo limite atingido — o servidor não respondeu a tempo. Suas credenciais podem ainda ser válidas.'
        );
      } else {
        setConnectionStatus('error');
        toast.error('Erro de conexão. Verifique sua rede.');
      }
    } finally {
      // Always clear the timeout and re-enable the button
      clearTimeout(timeoutId);
    }
  };

  const hasExistingCredentials = !!getCredentials();

  const renderConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Conectado
          </Badge>
        );
      case 'invalid':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Credenciais inválidas
          </Badge>
        );
      case 'timeout':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Tempo limite
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Erro de conexão
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="api-key" className="text-sm font-medium">
            API Key
          </Label>
          <Input
            id="api-key"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Insira sua Binance API Key"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-secret" className="text-sm font-medium">
            API Secret
          </Label>
          <div className="relative">
            <Input
              id="api-secret"
              type={showSecret ? 'text' : 'password'}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Insira sua Binance API Secret"
              className="font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="flex items-center gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>

        <Button
          onClick={handleTestConnection}
          disabled={connectionStatus === 'testing' || !hasExistingCredentials}
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
        >
          {connectionStatus === 'testing' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wifi className="w-3.5 h-3.5" />
          )}
          {connectionStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
        </Button>

        {hasExistingCredentials && (
          <Button
            onClick={handleClear}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </Button>
        )}
      </div>

      {/* Connection Status Badge */}
      {connectionStatus !== 'idle' && connectionStatus !== 'testing' && (
        <div className="flex flex-col gap-1.5">
          {renderConnectionBadge()}
          {connectionStatus === 'timeout' && timeoutMessage && (
            <p className="text-xs text-amber-400/80">{timeoutMessage}</p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Permissões necessárias:</strong> Habilite apenas{' '}
          <em>Futures Trading</em> na sua API Key. Nunca habilite saques.
        </p>
      </div>
    </div>
  );
}

export default BinanceCredentialsPanel;
