import { LayoutDashboard, Bot, Brain, ShieldCheck } from 'lucide-react';

export type TabId = 'dashboard' | 'ai-daily-trades' | 'ai-insights' | 'risk-management';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    id: 'ai-daily-trades',
    label: 'AI Daily Trades',
    icon: <Bot className="w-4 h-4" />,
  },
  {
    id: 'ai-insights',
    label: 'AI Insights',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: 'risk-management',
    label: 'Risk Management',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="border-b border-primary/20 bg-card/70 backdrop-blur-md sticky top-[73px] z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  whitespace-nowrap transition-all duration-200 min-h-[40px]
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md golden-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                  }
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
