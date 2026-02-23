import { PortfolioExposure } from '../types/exposure';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PieChart, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { ExposureChart } from './ExposureChart';

interface PortfolioExposureDashboardProps {
  exposure: PortfolioExposure;
}

export function PortfolioExposureDashboard({ exposure }: PortfolioExposureDashboardProps) {
  const hasWarnings =
    exposure.warningFlags.highExposure ||
    exposure.warningFlags.highCorrelation ||
    exposure.warningFlags.imbalancedPositions;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Portfolio Exposure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Capital Deployed</p>
              <p className="text-xl font-bold text-primary">
                ${exposure.totalCapitalDeployed.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Exposure</p>
              <p className="text-xl font-bold text-accent">
                ${exposure.totalLeverageExposure.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Leverage</p>
              <p className="text-xl font-bold">{exposure.weightedAverageLeverage}x</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Potential P&L</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-chart-1">
                  +${exposure.potentialProfit.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-sm font-medium text-destructive">
                  -${exposure.potentialLoss.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {hasWarnings && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-6 space-y-1">
                {exposure.warningFlags.highExposure && (
                  <p className="text-sm">
                    ⚠️ High leverage exposure detected. Consider reducing position sizes.
                  </p>
                )}
                {exposure.warningFlags.highCorrelation && (
                  <p className="text-sm">
                    ⚠️ Multiple correlated positions detected. Diversification recommended.
                  </p>
                )}
                {exposure.warningFlags.imbalancedPositions && (
                  <p className="text-sm">
                    ⚠️ Portfolio heavily skewed to one direction. Consider hedging.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Correlation Risks */}
          {exposure.correlationRisks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Correlation Risks
              </p>
              <div className="space-y-2">
                {exposure.correlationRisks.map((risk, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border"
                  >
                    <Badge
                      variant={
                        risk.riskLevel === 'high'
                          ? 'destructive'
                          : risk.riskLevel === 'medium'
                          ? 'default'
                          : 'secondary'
                      }
                      className="mt-0.5"
                    >
                      {risk.riskLevel}
                    </Badge>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{risk.positions.join(', ')}</p>
                      <p className="text-muted-foreground text-xs">{risk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <ExposureChart
            exposureByAsset={exposure.exposureByAsset}
            longShortBalance={exposure.longShortBalance}
            totalCapital={exposure.totalCapitalDeployed}
          />
        </CardContent>
      </Card>
    </div>
  );
}
