import { PositionWithPrice } from '../types/position';
import { PortfolioExposure } from '../types/exposure';
import { PositionSizeCalculator } from './PositionSizeCalculator';
import { PortfolioExposureDashboard } from './PortfolioExposureDashboard';
import { ScenarioSimulator } from './ScenarioSimulator';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

interface RiskManagementTabProps {
  positions: PositionWithPrice[];
  exposure: PortfolioExposure;
}

export function RiskManagementTab({ positions, exposure }: RiskManagementTabProps) {
  return (
    <div className="space-y-6">
      {/* Position Size Calculator */}
      <PositionSizeCalculator />

      {/* Portfolio Exposure Dashboard */}
      {positions.length > 0 ? (
        <PortfolioExposureDashboard exposure={exposure} positions={positions} />
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
