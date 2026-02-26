import { useState, useEffect } from 'react';
import { useActor } from './hooks/useActor';
import { TabNavigation, type TabId } from './components/TabNavigation';
import { LiveTradingBanner } from './components/LiveTradingBanner';
import { CredentialStatusIndicator } from './components/CredentialStatusIndicator';
import { DashboardTab } from './components/DashboardTab';
import { OrderTerminalTab } from './components/OrderTerminalTab';
import { SettingsTab } from './components/SettingsTab';
import { Toaster } from '@/components/ui/sonner';
import { Zap } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { actor, isFetching: actorLoading } = useActor();

  // Expose actor globally for proxy service
  useEffect(() => {
    if (actor) {
      (window as unknown as { __binanceActor: unknown }).__binanceActor = actor;
    }
  }, [actor]);

  const handleOpenSettings = () => setActiveTab('settings');

  return (
    <div className="min-h-screen bg-background terminal-grid flex flex-col">
      {/* Live Trading Banner */}
      <LiveTradingBanner />

      {/* App Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/20 border border-primary/40">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
                Binance Order Terminal
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                ICP Proxy · Futures Trading
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {actorLoading && (
              <span className="text-xs text-muted-foreground animate-pulse-gold">
                Connecting to ICP...
              </span>
            )}
            <CredentialStatusIndicator />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'dashboard' && (
          <DashboardTab onOpenSettings={handleOpenSettings} />
        )}
        {activeTab === 'order-terminal' && <OrderTerminalTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/50 py-4 px-4 mt-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Binance Order Terminal</span>
          <span className="flex items-center gap-1">
            Built with{' '}
            <span className="text-destructive">♥</span>{' '}
            using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname || 'unknown-app')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </span>
        </div>
      </footer>

      <Toaster richColors position="top-right" />
    </div>
  );
}
