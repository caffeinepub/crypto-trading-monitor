import { useState } from 'react';
import { PositionEntryForm } from './components/PositionEntryForm';
import { PositionDashboard } from './components/PositionDashboard';
import { InstallButton } from './components/InstallButton';
import { PositionSizeCalculator } from './components/PositionSizeCalculator';
import { PortfolioExposureDashboard } from './components/PortfolioExposureDashboard';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { TotalCapitalSummary } from './components/TotalCapitalSummary';
import { usePositionStorage } from './hooks/usePositionStorage';
import { usePositionMonitoring } from './hooks/usePositionMonitoring';
import { usePortfolioExposure } from './hooks/usePortfolioExposure';
import { SiX, SiGithub } from 'react-icons/si';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

function App() {
  const { positions, addPosition, updatePosition, deletePosition } = usePositionStorage();
  const { data: positionsWithPrice = [] } = usePositionMonitoring(positions);
  const exposure = usePortfolioExposure(positionsWithPrice);
  const [showForm, setShowForm] = useState(true);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [riskToolsOpen, setRiskToolsOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden">
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
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Total Capital Summary - Prominent placement at top */}
          <div className="mb-6">
            <TotalCapitalSummary positions={positionsWithPrice} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Position Size Calculator */}
                <Collapsible open={calculatorOpen} onOpenChange={setCalculatorOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between border-primary/30 mb-2">
                      <span>Position Size Calculator</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${calculatorOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <PositionSizeCalculator />
                  </CollapsibleContent>
                </Collapsible>

                {/* Position Entry Form */}
                <PositionEntryForm
                  onSubmit={(position) => {
                    addPosition(position);
                    setShowForm(false);
                  }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Portfolio Exposure Dashboard */}
              {positionsWithPrice.length > 0 && (
                <PortfolioExposureDashboard exposure={exposure} positions={positionsWithPrice} />
              )}

              {/* Risk Management Tools */}
              {positionsWithPrice.length > 0 && (
                <Collapsible open={riskToolsOpen} onOpenChange={setRiskToolsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between border-primary/30">
                      <span>Scenario Simulator</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${riskToolsOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <ScenarioSimulator positions={positionsWithPrice} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Position Dashboard */}
              <PositionDashboard
                positions={positions}
                onUpdate={updatePosition}
                onDelete={deletePosition}
                onAddNew={() => setShowForm(true)}
              />
            </div>
          </div>
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
  );
}

export default App;
