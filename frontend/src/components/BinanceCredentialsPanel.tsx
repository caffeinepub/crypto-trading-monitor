import { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, Shield, Wifi, WifiOff, Loader2, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { saveCredentials, clearCredentials, getStoredCredentials } from '../utils/binanceAuth';
import { authenticatedFetch } from '../utils/binanceAuth';
import { BinanceAccountResponse } from '../types/binanceApi';
import { toast } from 'sonner';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error';

export function BinanceCredentialsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [hasStored, setHasStored] = useState(false);

  useEffect(() => {
    const creds = getStoredCredentials();
    if (creds) {
      setApiKey(creds.apiKey);
      setSecret(creds.secret);
      setHasStored(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim() || !secret.trim()) {
      toast.error('Por favor, preencha a API Key e o Secret.');
      return;
    }
    saveCredentials(apiKey.trim(), secret.trim());
    setHasStored(true);
    setConnectionStatus('idle');
    toast.success('Credenciais salvas com sucesso!', {
      description: 'Suas chaves estão armazenadas localmente no navegador.',
    });
  };

  const handleClear = () => {
    clearCredentials();
    setApiKey('');
    setSecret('');
    setHasStored(false);
    setConnectionStatus('idle');
    toast.info('Credenciais removidas.');
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !secret.trim()) {
      toast.error('Salve as credenciais antes de testar a conexão.');
      return;
    }

    // Temporarily save to test
    saveCredentials(apiKey.trim(), secret.trim());
    setConnectionStatus('testing');

    try {
      await authenticatedFetch(
        'https://fapi.binance.com/fapi/v2/account',
        'GET'
      ) as BinanceAccountResponse;
      setConnectionStatus('connected');
      toast.success('✅ Conexão com a Binance estabelecida!', {
        description: 'Suas credenciais são válidas e a conta está acessível.',
      });
    } catch (err) {
      setConnectionStatus('error');
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('❌ Falha na conexão com a Binance', {
        description: errMsg,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Security Notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Segurança:</span> Suas chaves são
          armazenadas <strong>apenas localmente</strong> no seu navegador (localStorage) e{' '}
          <strong>nunca são enviadas</strong> para nenhum servidor externo. Use chaves com
          permissão apenas de <em>Futures Trading</em> e sem permissão de saque.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="binance-api-key" className="text-sm font-medium flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-primary" />
          API Key
        </Label>
        <Input
          id="binance-api-key"
          type="text"
          placeholder="Cole sua Binance Futures API Key aqui..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono text-sm bg-card border-primary/20 focus:border-primary/50"
        />
      </div>

      {/* Secret Key */}
      <div className="space-y-2">
        <Label htmlFor="binance-secret" className="text-sm font-medium flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-primary" />
          Secret Key
        </Label>
        <div className="relative">
          <Input
            id="binance-secret"
            type={showSecret ? 'text' : 'password'}
            placeholder="Cole seu Secret Key aqui..."
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="font-mono text-sm pr-10 bg-card border-primary/20 focus:border-primary/50"
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

      {/* Connection Status Badge */}
      {connectionStatus !== 'idle' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {connectionStatus === 'testing' && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Testando...
            </Badge>
          )}
          {connectionStatus === 'connected' && (
            <Badge className="gap-1.5 bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
              <Wifi className="w-3 h-3" />
              Conectado
            </Badge>
          )}
          {connectionStatus === 'error' && (
            <Badge variant="destructive" className="gap-1.5">
              <WifiOff className="w-3 h-3" />
              Credenciais inválidas
            </Badge>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          onClick={handleSave}
          size="sm"
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="w-3.5 h-3.5" />
          Salvar Credenciais
        </Button>

        <Button
          onClick={handleTestConnection}
          size="sm"
          variant="outline"
          disabled={connectionStatus === 'testing'}
          className="gap-2 border-primary/30 hover:bg-primary/10"
        >
          {connectionStatus === 'testing' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wifi className="w-3.5 h-3.5" />
          )}
          Testar Conexão
        </Button>

        {hasStored && (
          <Button
            onClick={handleClear}
            size="sm"
            variant="outline"
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Credenciais
          </Button>
        )}
      </div>
    </div>
  );
}
