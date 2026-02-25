import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PositionWithPrice } from '../types/position';
import { RecoveryStrategy, RiskLevel } from '../types/recovery';
import { analyzePositionRecovery } from '../utils/positionRecoveryEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Shield,
  GitMerge,
  ArrowDownUp,
  Target,
  ChevronRight,
} from 'lucide-react';

interface PositionRecoveryCardProps {
  position: PositionWithPrice;
}

const STRATEGY_ICONS: Record<string, React.ReactNode> = {
  hedge: <GitMerge className="w-4 h-4" />,
  dca: <ArrowDownUp className="w-4 h-4" />,
  partial_close: <Shield className="w-4 h-4" />,
  tp_sl_adjustment: <Target className="w-4 h-4" />,
};

const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  low: 'bg-chart-1/20 text-chart-1 border-chart-1/40',
  medium: 'border-primary/60 text-primary bg-primary/10',
  high: 'bg-destructive/20 text-destructive border-destructive/40',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_BADGE_CLASSES[level]}`}
    >
      {RISK_LABELS[level]}
    </span>
  );
}

function StrategyItem({ strategy, index }: { strategy: RecoveryStrategy; index: number }) {
  return (
    <AccordionItem value={`strategy-${index}`} className="border-primary/20">
      <AccordionTrigger className="hover:no-underline py-3 px-1">
        <div className="flex items-center gap-3 flex-1 text-left">
          <span className="text-primary">{STRATEGY_ICONS[strategy.strategyType]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{strategy.title}</span>
              <RiskBadge level={strategy.riskLevel} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Est. recovery: <span className="text-chart-1 font-medium">{strategy.estimatedRecoveryPct}%</span> of loss
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-1 pb-4">
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{strategy.description}</p>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Action Steps</p>
          <ol className="space-y-1.5">
            {strategy.actionableSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PositionRecoveryCard({ position }: PositionRecoveryCardProps) {
  const isLoss = position.pnlUSD < 0;
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStrategies = useCallback(async (): Promise<RecoveryStrategy[]> => {
    if (!isLoss) return [];
    return analyzePositionRecovery({
      symbol: position.symbol,
      positionType: position.positionType,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      leverage: position.leverage,
      investmentAmount: position.investmentAmount,
      stopLossPrice: position.stopLoss.price,
      takeProfitPrice: position.takeProfitLevels[0]?.price,
      totalExposure: position.totalExposure,
    });
  }, [
    isLoss,
    position.symbol,
    position.positionType,
    position.entryPrice,
    position.currentPrice,
    position.leverage,
    position.investmentAmount,
    position.stopLoss.price,
    position.takeProfitLevels,
    position.totalExposure,
    refreshKey, // eslint-disable-line react-hooks/exhaustive-deps
  ]);

  const {
    data: strategies = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<RecoveryStrategy[]>({
    queryKey: ['recovery-strategies', position.id, position.currentPrice, refreshKey],
    queryFn: fetchStrategies,
    enabled: isLoss,
    staleTime: 30_000,
    refetchInterval: false,
  });

  // Don't render anything for profitable positions
  if (!isLoss) return null;

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    refetch();
  };

  const lossUSD = Math.abs(position.pnlUSD);
  const lossPct = Math.abs(position.pnlPercent);

  return (
    <Card className="border-2 border-warning/40 bg-warning/5 shadow-lg shadow-warning/10 mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <CardTitle className="text-base text-warning">Recovery Mode</CardTitle>
            <Badge
              variant="outline"
              className="border-warning/60 text-warning bg-warning/10 text-xs font-semibold"
            >
              Position in Loss
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching || isLoading}
            className="border-warning/40 text-warning hover:bg-warning/10 hover:text-warning h-8 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing…' : 'Refresh Strategies'}
          </Button>
        </div>

        {/* Current Loss Display */}
        <div className="flex items-center gap-4 mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <TrendingDown className="w-5 h-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Current Loss</p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-destructive">
                -${lossUSD.toFixed(2)}
              </span>
              <Badge variant="destructive" className="text-sm font-bold">
                -{lossPct.toFixed(2)}%
              </Badge>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Entry: <span className="text-foreground font-medium">${position.entryPrice.toFixed(4)}</span></div>
            <div>Current: <span className="text-destructive font-medium">${position.currentPrice.toFixed(4)}</span></div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Separator className="bg-warning/20 mb-4" />

        {isLoading ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin text-warning" />
              <span>Analyzing recovery strategies…</span>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>No recovery strategies available at this time.</p>
            <p className="text-xs mt-1">Try refreshing or check your connection.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="w-4 h-4 text-warning" />
              <p className="text-sm font-medium text-foreground">
                {strategies.length} recovery {strategies.length === 1 ? 'strategy' : 'strategies'} available
              </p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {strategies.map((strategy, index) => (
                <StrategyItem key={strategy.strategyType} strategy={strategy} index={index} />
              ))}
            </Accordion>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-warning/20">
          ⚠️ These are advisory strategies only. Always manage your own risk and never invest more than you can afford to lose.
        </p>
      </CardContent>
    </Card>
  );
}
