import { useState } from 'react';
import { InstallButton } from './components/InstallButton';
import { usePositionStorage } from './hooks/usePositionStorage';
import { usePositionMonitoring } from './hooks/usePositionMonitoring';
import { usePortfolioExposure } from './hooks/usePortfolioExposure';
import { TabNavigation, TabId } from './components/TabNavigation';
import { DashboardTab } from './components/DashboardTab';
import { AIDailyTradesTab } from './components/AIDailyTradesTab';
import { AIInsightsTab } from './components/AIInsightsTab';
import { RiskManagementTab } from './components/RiskManagementTab';
import { SettingsDialog } from './components/SettingsDialog';
import { CredentialStatusIndicator } from './components/CredentialStatusIndicator';
import { LiveTradingBanner } from './components/LiveTradingBanner';
import { SiX, SiGithub } from 'react-icons/si';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

function App() {
  const { positions, addPosition, updatePosition, removePosition } = usePositionStorage();
  const { data: positionsWithPrice = [] } = usePositionMonitoring(positions);
  const exposure = usePortfolioExposure(positionsWithPrice);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Root wrapper — no overflow-hidden so Dialog portals are never clipped */}
      <div className="min-h-screen relative">
        {/* Tech Background */}
        <div
          className="fixed inset-0 z-0 opacity-[0.15] dark:opacity-[0.08]"
          style={{
            backgroundImage: 'url(/assets/generated/tech-bg-golden.dim_1920x1080.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        />

        {/* Gradient Overlay */}
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-background/95 to-primary/5" />

        {/* Grid Pattern Overlay */}
        <div className="fixed inset-0 z-0 tech-pattern opacity-40" />

        {/* Content */}
        <div className="relative z-10">
          {/* Live Trading Banner — shown above header when active */}
          <LiveTradingBanner />

          {/* App Header */}
          <header className="border-b border-primary/20 bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-lg">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Wolf/Crypto Logo */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden golden-glow flex-shrink-0">
                    <img
                      src="/assets/generated/app-logo.dim_512x512.png"
                      alt="Crypto Position Monitor Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                      Crypto Position Monitor
                    </h1>
                    <p className="text-sm text-muted-foreground">AI-Powered Trading Assistant</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Credential Status Indicator */}
                  <CredentialStatusIndicator onClick={() => setSettingsOpen(true)} />

                  <InstallButton />

                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <SiX className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <SiGithub className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>

                  {/* Settings Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Abrir configurações"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          {/* Tab Navigation */}
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <main className="container mx-auto px-4 py-8">
            {activeTab === 'dashboard' && (
              <DashboardTab
                positions={positions}
                positionsWithPrice={positionsWithPrice}
                onAddPosition={addPosition}
                onUpdatePosition={updatePosition}
                onDeletePosition={removePosition}
              />
            )}

            {activeTab === 'ai-daily-trades' && <AIDailyTradesTab />}

            {activeTab === 'ai-insights' && (
              <AIInsightsTab
                positions={positionsWithPrice}
                onUpdatePosition={updatePosition}
              />
            )}

            {activeTab === 'risk-management' && (
              <RiskManagementTab
                positions={positionsWithPrice}
                exposure={exposure}
              />
            )}
          </main>

          <footer className="border-t border-primary/20 bg-card/60 backdrop-blur-md mt-16">
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  © {new Date().getFullYear()} Crypto Position Monitor. Real-time trading insights.
                </p>
                <p className="text-sm text-muted-foreground">
                  Built with{' '}
                  <span className="text-primary">❤️</span> using{' '}
                  <a
                    href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                      typeof window !== 'undefined' ? window.location.hostname : 'crypto-monitor'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-accent transition-colors font-medium"
                  >
                    caffeine.ai
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Settings Dialog — rendered outside the stacking context to avoid z-index / overflow clipping */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

export default App;
