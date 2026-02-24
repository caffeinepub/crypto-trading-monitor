import { PositionWithPrice } from '../types/position';
import { PortfolioExposure } from '../types/exposure';
import { EnrichedPosition } from '../hooks/usePortfolioExposure';
import { PositionSizeCalculator } from './PositionSizeCalculator';
import PortfolioExposureDashboard from './PortfolioExposureDashboard';
import { ScenarioSimulator } from './ScenarioSimulator';
import { LiveRiskMetricsCard } from './LiveRiskMetricsCard';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

interface RiskManagementTabProps {
  positions: PositionWithPrice[];
  exposure: PortfolioExposure;
  enrichedPositions?: EnrichedPosition[];
  livePricesLoading?: boolean;
  livePricesError?: boolean;
}

export function RiskManagementTab({
  positions,
  exposure,
  enrichedPositions,
  livePricesLoading,
  livePricesError,
}: RiskManagementTabProps) {
  return (
    <div className="space-y-6">
      {/* Live Risk Metrics Card — shown only when positions exist */}
      {positions.length > 0 ? (
        <LiveRiskMetricsCard positions={positions} />
      ) : null}

      {/* Position Size Calculator */}
      <PositionSizeCalculator />

      {/* Portfolio Exposure Dashboard */}
      {positions.length > 0 ? (
        <PortfolioExposureDashboard
          exposure={exposure}
          positions={positions}
          enrichedPositions={enrichedPositions}
          livePricesLoading={livePricesLoading}
          livePricesError={livePricesError}
        />
      ) : (
        <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="py-10 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">
              Add positions from the Dashboard tab to see portfolio exposure analysis.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scenario Simulator */}
      <ScenarioSimulator positions={positions} />
    </div>
  );
}
