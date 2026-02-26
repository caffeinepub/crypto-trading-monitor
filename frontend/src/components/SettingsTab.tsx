import { useState, useEffect } from 'react';
import { saveCredentials, clearCredentials, getCredentials, hasCredentials } from '../utils/credentialsStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldAlert,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const FAPI_BASE = 'https://fapi.binance.com/fapi/v2';

type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed';

export function SettingsTab() {
  const stored = getCredentials();
  const [apiKey, setApiKey] = useState(stored.apiKey);
  const [apiSecret, setApiSecret] = useState(stored.apiSecret);
  const [showSecret, setShowSecret] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [isLive, setIsLive] = useState(() => localStorage.getItem('live_trading_enabled') === 'true');
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);

  // Sync live trading state
  useEffect(() => {
    const handler = () => setIsLive(localStorage.getItem('live_trading_enabled') === 'true');
    window.addEventListener('live-trading-change', handler);
    return () => window.removeEventListener('live-trading-change', handler);
  }, []);

  const handleSave = () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error('Both API Key and Secret are required');
      return;
    }
    saveCredentials(apiKey.trim(), apiSecret.trim());
    toast.success('API credentials saved successfully');
    setConnectionStatus('idle');
  };

  const handleClear = () => {
    clearCredentials();
    setApiKey('');
    setApiSecret('');
    setConnectionStatus('idle');
    toast.info('API credentials cleared');
  };

  const handleTestConnection = async () => {
    if (!hasCredentials()) {
      toast.error('Save your credentials first');
      return;
    }
    setConnectionStatus('testing');
    try {
      const { apiKey: key, apiSecret: secret } = getCredentials();
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;

      // HMAC-SHA256 signing via SubtleCrypto
      const encoder = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(queryString));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${FAPI_BASE}/account?${queryString}&signature=${signature}`, {
        headers: { 'X-MBX-APIKEY': key },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        setConnectionStatus('connected');
        toast.success('Connection successful — Binance API is working');
      } else {
        const data = await response.json().catch(() => ({}));
        setConnectionStatus('failed');
        toast.error(`Connection failed: ${data.msg ?? `HTTP ${response.status}`}`);
      }
    } catch (err) {
      setConnectionStatus('failed');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('abort') || msg.includes('timeout')) {
        toast.error('Connection test timed out after 15 seconds');
      } else {
        toast.error(`Connection test failed: ${msg}`);
      }
    }
  };

  const handleLiveToggle = (checked: boolean) => {
    if (checked) {
      setShowLiveConfirm(true);
    } else {
      localStorage.setItem('live_trading_enabled', 'false');
      setIsLive(false);
      window.dispatchEvent(new CustomEvent('live-trading-change'));
      toast.info('Live Trading disabled');
    }
  };

  const confirmEnableLive = () => {
    localStorage.setItem('live_trading_enabled', 'true');
    setIsLive(true);
    window.dispatchEvent(new CustomEvent('live-trading-change'));
    setShowLiveConfirm(false);
    toast.warning('Live Trading ENABLED — real orders will be sent to Binance');
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>

        {/* API Credentials */}
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Binance API Credentials</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Your keys are stored locally in your browser and sent only to the Internet Computer canister for signing — never to any third-party server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                API Key
              </Label>
              <Input
                type="text"
                placeholder="Enter your Binance API Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm border-border/60 bg-input"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                API Secret
              </Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Enter your Binance API Secret..."
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="font-mono text-sm border-border/60 bg-input pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleSave}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Key className="h-4 w-4" />
                Save Credentials
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4" />
                Clear
              </Button>
            </div>

            <div className="p-3 rounded-md bg-warning/10 border border-warning/30 flex gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>
                For security, create a Binance API key with <strong className="text-foreground">Futures trading only</strong> and restrict it to your IP address. Never enable withdrawal permissions.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Connection Test */}
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Connection Test</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Verify your API credentials by connecting to Binance Futures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing' || !hasCredentials()}
                className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              >
                {connectionStatus === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>

              {connectionStatus === 'connected' && (
                <Badge className="gap-1 bg-chart-1/20 text-chart-1 border border-chart-1/40">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Connected ✓
                </Badge>
              )}
              {connectionStatus === 'failed' && (
                <Badge className="gap-1 bg-destructive/20 text-destructive border border-destructive/40">
                  <XCircle className="h-3.5 w-3.5" />
                  Invalid credentials ✗
                </Badge>
              )}
              {connectionStatus === 'idle' && hasCredentials() && (
                <span className="text-xs text-muted-foreground">Credentials saved — click to test</span>
              )}
              {!hasCredentials() && (
                <span className="text-xs text-muted-foreground">Save credentials first</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Trading Toggle */}
        <Card className={`border-border/60 bg-card ${isLive ? 'border-warning/50 shadow-golden-glow' : ''}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${isLive ? 'text-warning' : 'text-muted-foreground'}`} />
              <CardTitle className="text-base">Live Trading Mode</CardTitle>
              {isLive && (
                <Badge className="ml-auto bg-warning/20 text-warning border border-warning/40 text-xs">
                  ACTIVE
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              When enabled, orders placed in the Order Terminal will be sent as real orders to Binance Futures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/40">
              <div>
                <p className="text-sm font-medium">
                  {isLive ? (
                    <span className="text-warning">Live Trading is ON</span>
                  ) : (
                    <span className="text-muted-foreground">Live Trading is OFF</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isLive
                    ? 'Real orders will be sent to Binance Futures'
                    : 'Orders are blocked — safe mode active'}
                </p>
              </div>
              <Switch
                checked={isLive}
                onCheckedChange={handleLiveToggle}
                className="data-[state=checked]:bg-warning"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Trading Confirmation Dialog */}
      <AlertDialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <AlertDialogContent className="border-warning/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Enable Live Trading?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to enable <strong>Live Trading Mode</strong>. This means:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All orders placed will be <strong>real orders</strong> on Binance Futures</li>
                <li>Real funds will be used from your Binance account</li>
                <li>Orders cannot be undone once submitted</li>
              </ul>
              <p className="text-warning font-medium mt-2">
                Make sure your API credentials are correct and you understand the risks.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLiveConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEnableLive}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Yes, Enable Live Trading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SettingsTab;
