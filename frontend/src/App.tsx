import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { usePositionStorage } from './hooks/usePositionStorage';
import { usePositionMonitoring } from './hooks/usePositionMonitoring';
import { usePortfolioExposure } from './hooks/usePortfolioExposure';
import { TabNavigation, TabId } from './components/TabNavigation';
import { DashboardTab } from './components/DashboardTab';
import { AIDailyTradesTab } from './components/AIDailyTradesTab';
import { AIInsightsTab } from './components/AIInsightsTab';
import { RiskManagementTab } from './components/RiskManagementTab';
import { SettingsDialog } from './components/SettingsDialog';
import { LiveTradingBanner } from './components/LiveTradingBanner';
import { CredentialStatusIndicator } from './components/CredentialStatusIndicator';
import { InstallButton } from './components/InstallButton';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hasCredentials, isLiveTradingEnabled } from './utils/liveTradingStorage';
import { fetchOpenPositions } from './services/binancePositionService';
import { authenticatedFetch } from './utils/binanceAuth';
import { getCredentials } from './utils/liveTradingStorage';
import { getTotalCapital, setTotalCapital } from './utils/totalCapitalStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    positions,
    addPosition,
    removePosition,
    updatePosition,
  } = usePositionStorage();

  const { data: positionsWithPrice = [] } = usePositionMonitoring(positions);
  const {
    exposure,
    enrichedPositions,
    livePricesLoading,
    livePricesError,
  } = usePortfolioExposure(positionsWithPrice);

  // Track whether the initial auto-import has already run this session
  const autoImportRanRef = useRef(false);
  // Track whether the auto-capital-fill has already run this session
  const autoCapitalRanRef = useRef(false);
  // Ref to hold the current positions for use inside interval without stale closure
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // ── REQ-113: Auto-import open positions on mount when credentials are present ──
  useEffect(() => {
    if (autoImportRanRef.current) return;
    if (!hasCredentials()) return;

    autoImportRanRef.current = true;

    (async () => {
      try {
        const imported = await fetchOpenPositions();
        if (imported.length === 0) return;

        const currentSymbols = new Set(positionsRef.current.map((p) => p.symbol));
        const newPositions = imported.filter((p) => !currentSymbols.has(p.symbol));

        if (newPositions.length === 0) return;

        for (const pos of newPositions) {
          await addPosition(pos);
        }

        toast.success(`Auto-importadas ${newPositions.length} posição(ões) da Binance`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        toast.error(`Falha ao auto-importar posições: ${message}`);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── REQ-117: Auto-fill total capital from Binance account balance on mount ──
  useEffect(() => {
    if (autoCapitalRanRef.current) return;
    if (!hasCredentials()) return;

    const existingCapital = getTotalCapital();
    if (existingCapital && existingCapital > 0) return;

    autoCapitalRanRef.current = true;

    (async () => {
      try {
        const creds = getCredentials();
        if (!creds) return;

        const response = await authenticatedFetch(
          'https://fapi.binance.com/fapi/v2/account',
          creds
        );

        if (!response.ok) return;

        const data = await response.json() as { totalWalletBalance?: string };
        const balance = parseFloat(data.totalWalletBalance ?? '0');

        if (balance > 0) {
          setTotalCapital(balance);
          toast.success(`Capital total definido automaticamente da Binance: $${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
      } catch {
        // Silently fail — do not block the UI
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── REQ-114: Listen for 'trigger-dashboard-switch' to switch to Dashboard tab ──
  useEffect(() => {
    const handler = () => {
      setActiveTab('dashboard');
    };
    window.addEventListener('trigger-dashboard-switch', handler);
    return () => window.removeEventListener('trigger-dashboard-switch', handler);
  }, []);

  // ── REQ-115: Periodic 60-second background sync when credentials + live trading are active ──
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }

    if (!hasCredentials() || !isLiveTradingEnabled()) return;

    syncIntervalRef.current = setInterval(async () => {
      if (!hasCredentials() || !isLiveTradingEnabled()) {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
        return;
      }

      try {
        const binancePositions = await fetchOpenPositions();
        const binanceSymbols = new Set(binancePositions.map((p) => p.symbol));
        const localPositions = positionsRef.current;
        const localSymbols = new Set(localPositions.map((p) => p.symbol));

        // Find new positions to add
        const toAdd = binancePositions.filter((p) => !localSymbols.has(p.symbol));
        // Find closed positions to remove (symbol no longer in Binance response)
        const toRemove = localPositions.filter((p) => !binanceSymbols.has(p.symbol));

        for (const pos of toAdd) {
          await addPosition(pos);
        }
        for (const pos of toRemove) {
          removePosition(pos.id);
        }

        if (toAdd.length > 0 || toRemove.length > 0) {
          const parts: string[] = [];
          if (toAdd.length > 0) parts.push(`+${toAdd.length} nova(s)`);
          if (toRemove.length > 0) parts.push(`-${toRemove.length} fechada(s)`);
          toast.info(`Sync Binance: ${parts.join(', ')}`);
        }
      } catch {
        // Silently fail routine syncs
      }
    }, 60_000);
  }, [addPosition, removePosition]);

  // Start/stop sync interval based on credential and live trading changes
  useEffect(() => {
    startSyncInterval();

    const handleChange = () => {
      startSyncInterval();
    };

    window.addEventListener('credential-change', handleChange);
    window.addEventListener('live-trading-change', handleChange);

    return () => {
      window.removeEventListener('credential-change', handleChange);
      window.removeEventListener('live-trading-change', handleChange);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [startSyncInterval]);

  // ── REQ-117: Re-run capital auto-fill when credentials are saved for the first time ──
  useEffect(() => {
    const handleCredentialChange = () => {
      if (!hasCredentials()) return;
      const existingCapital = getTotalCapital();
      if (existingCapital && existingCapital > 0) return;

      (async () => {
        try {
          const creds = getCredentials();
          if (!creds) return;

          const response = await authenticatedFetch(
            'https://fapi.binance.com/fapi/v2/account',
            creds
          );

          if (!response.ok) return;

          const data = await response.json() as { totalWalletBalance?: string };
          const balance = parseFloat(data.totalWalletBalance ?? '0');

          if (balance > 0) {
            setTotalCapital(balance);
            toast.success(`Capital total definido automaticamente da Binance: $${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          }
        } catch {
          // Silently fail
        }
      })();
    };

    window.addEventListener('credential-change', handleCredentialChange);
    return () => window.removeEventListener('credential-change', handleCredentialChange);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/generated/app-logo.dim_512x512.png"
              alt="CryptoTrader AI"
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <h1 className="text-lg font-bold text-primary leading-none">CryptoTrader AI</h1>
              <p className="text-xs text-muted-foreground">Futures Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CredentialStatusIndicator />
            <InstallButton />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenSettings}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Live Trading Banner */}
      <LiveTradingBanner />

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {activeTab === 'dashboard' && (
          <DashboardTab
            positions={positions}
            positionsWithPrice={positionsWithPrice}
            onAddPosition={addPosition}
            onRemovePosition={removePosition}
            onUpdatePosition={updatePosition}
            onOpenSettings={handleOpenSettings}
          />
        )}
        {activeTab === 'ai-daily-trades' && (
          <AIDailyTradesTab />
        )}
        {activeTab === 'ai-insights' && (
          <AIInsightsTab
            positions={positionsWithPrice}
            onUpdatePosition={(id, updates) => {
              const pos = positionsWithPrice.find((p) => p.id === id);
              if (pos) updatePosition({ ...pos, ...updates } as typeof pos);
            }}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === 'risk-management' && (
          <RiskManagementTab
            positions={positionsWithPrice}
            exposure={exposure}
            enrichedPositions={enrichedPositions}
            livePricesLoading={livePricesLoading}
            livePricesError={livePricesError}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()} CryptoTrader AI — Built with{' '}
          <span className="text-primary">♥</span> using{' '}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || 'cryptotrader-ai')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      {/* Settings Dialog — rendered outside stacking context */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <Toaster richColors position="top-right" />
    </div>
  );
}
