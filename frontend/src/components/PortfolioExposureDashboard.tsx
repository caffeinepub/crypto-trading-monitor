import { useState, useEffect } from 'react';
import { PortfolioExposure } from '../types/exposure';
import { PositionWithPrice } from '../types/position';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PieChart, AlertTriangle, TrendingUp, Shield, DollarSign } from 'lucide-react';
import { ExposureChart } from './ExposureChart';
import { TotalCapitalInput } from './TotalCapitalInput';
import { getTotalCapital } from '../utils/totalCapitalStorage';

interface PortfolioExposureDashboardProps {
  exposure: PortfolioExposure;
  positions: PositionWithPrice[];
}

export function PortfolioExposureDashboard({ exposure, positions }: PortfolioExposureDashboardProps) {
  const [totalCapital, setTotalCapital] = useState<number | null>(getTotalCapital());
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setTotalCapital(getTotalCapital());
  }, [positions]);

  const handleCapitalUpdate = (newValue: number) => {
    setTotalCapital(newValue);
    setDialogOpen(false);
  };

  const hasWarnings =
    exposure.warningFlags.highExposure ||
    exposure.warningFlags.highCorrelation ||
    exposure.warningFlags.imbalancedPositions;

  // Calculate deployed capital and capital at risk
  const deployedCapital = exposure.totalCapitalDeployed;
  const capitalAtRisk = positions.reduce((sum, pos) => {
    if (!pos.stopLoss) return sum;
    
    const stopLossPrice = pos.stopLoss.price;
    const priceDiff = pos.positionType === 'Long' 
      ? pos.entryPrice - stopLossPrice 
      : stopLossPrice - pos.entryPrice;
    
    const lossPercent = (priceDiff / pos.entryPrice) * 100;
    const potentialLoss = (pos.investmentAmount * pos.leverage * lossPercent) / 100;
    
    return sum + Math.abs(potentialLoss);
  }, 0);

  // Calculate percentages if total capital is set
  const deployedPercent = totalCapital ? (deployedCapital / totalCapital) * 100 : null;
  const riskPercent = totalCapital ? (capitalAtRisk / totalCapital) * 100 : null;
  const availableCapital = totalCapital ? totalCapital - deployedCapital : null;
  const availablePercent = totalCapital && availableCapital !== null ? (availableCapital / totalCapital) * 100 : null;

  // Check for warnings based on percentages
  const highDeploymentWarning = deployedPercent !== null && deployedPercent > 50;
  const highRiskWarning = riskPercent !== null && riskPercent > 10;

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
              {deployedPercent !== null && (
                <p className="text-xs text-muted-foreground">
                  {deployedPercent.toFixed(1)}% of total
                </p>
              )}
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

          {/* Total Capital Metrics */}
          {totalCapital ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Capital at Risk</p>
                <p className="text-lg font-bold text-destructive">
                  ${capitalAtRisk.toLocaleString()}
                </p>
                {riskPercent !== null && (
                  <p className="text-xs text-muted-foreground">
                    {riskPercent.toFixed(1)}% of total
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Available Capital</p>
                <p className="text-lg font-bold text-chart-1">
                  ${availableCapital?.toLocaleString()}
                </p>
                {availablePercent !== null && (
                  <p className="text-xs text-muted-foreground">
                    {availablePercent.toFixed(1)}% of total
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Capital</p>
                <p className="text-lg font-bold text-primary">
                  ${totalCapital.toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Set your total capital to see risk percentages</span>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2">
                        <DollarSign className="w-3 h-3 mr-1" />
                        Set Capital
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Set Total Trading Capital</DialogTitle>
                      </DialogHeader>
                      <TotalCapitalInput onSave={handleCapitalUpdate} />
                    </DialogContent>
                  </Dialog>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Percentage-based Warnings */}
          {(highDeploymentWarning || highRiskWarning) && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="ml-6 space-y-1">
                {highDeploymentWarning && (
                  <p className="text-sm">
                    ⚠️ Warning: {deployedPercent?.toFixed(1)}% of capital deployed ({'>'}50% threshold)
                  </p>
                )}
                {highRiskWarning && (
                  <p className="text-sm">
                    ⚠️ Warning: {riskPercent?.toFixed(1)}% of capital at risk ({'>'}10% threshold)
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

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

          {/* Exposure Charts */}
          <ExposureChart
            exposureByAsset={exposure.exposureByAsset}
            longShortBalance={exposure.longShortBalance}
            totalCapital={totalCapital || deployedCapital}
          />
        </CardContent>
      </Card>
    </div>
  );
}
