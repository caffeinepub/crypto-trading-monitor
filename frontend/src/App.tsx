import React, { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
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
  const exposure = usePortfolioExposure(positionsWithPrice);

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
              onClick={() => setSettingsOpen(true)}
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
          />
        )}
        {activeTab === 'risk-management' && (
          <RiskManagementTab
            positions={positionsWithPrice}
            exposure={exposure}
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
