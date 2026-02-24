import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, BarChart2, Activity } from 'lucide-react';
import { PositionWithPrice } from '../types/position';
import { PortfolioExposure } from '../types/exposure';
import { ExposureChart } from './ExposureChart';
import { getTotalCapital } from '../utils/totalCapitalStorage';

interface PortfolioExposureDashboardProps {
  exposure: PortfolioExposure;
  positions: PositionWithPrice[];
}

export function PortfolioExposureDashboard({ exposure, positions }: PortfolioExposureDashboardProps) {
  // Reactive total capital — updates immediately when capital is changed elsewhere
  // Listens to 'total-capital-change' custom DOM event
  const [totalCapital, setTotalCapitalState] = useState<number | null>(() => getTotalCapital());

  useEffect(() => {
    const handler = () => {
      setTotalCapitalState(getTotalCapital());
    };

    window.addEventListener('total-capital-change', handler);

    return () => {
      window.removeEventListener('total-capital-change', handler);
    };
  }, []); // Empty dependency array — register once only

  // Use the correct PortfolioExposure field names from types/exposure.ts
  const deployedPct = useMemo(() => {
    if (!totalCapital || totalCapital <= 0) return null;
    return (exposure.totalCapitalDeployed / totalCapital) * 100;
  }, [exposure.totalCapitalDeployed, totalCapital]);

  // Calculate capital at risk from positions
  const capitalAtRisk = useMemo(() => {
    return positions.reduce((sum, pos) => {
      if (!pos.stopLoss) return sum;
      const slPrice = pos.stopLoss.price;
      const priceDiff = pos.positionType === 'Long'
        ? pos.entryPrice - slPrice
        : slPrice - pos.entryPrice;
      const lossPercent = Math.abs(priceDiff / pos.entryPrice);
      return sum + pos.investmentAmount * pos.leverage * lossPercent;
    }, 0);
  }, [positions]);

  const atRiskPct = useMemo(() => {
    if (!totalCapital || totalCapital <= 0) return null;
    return (capitalAtRisk / totalCapital) * 100;
  }, [capitalAtRisk, totalCapital]);

  const formatUSD = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  if (positions.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Exposição do Portfólio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Adicione posições para ver a análise de exposição do portfólio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Exposição do Portfólio
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {deployedPct !== null && deployedPct > 50 && (
              <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Alta Exposição
              </Badge>
            )}
            {atRiskPct !== null && atRiskPct > 10 && (
              <Badge className="text-xs bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Alto Risco
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Capital metrics */}
        {totalCapital === null && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              Configure seu capital total nas Configurações para ver percentuais de exposição.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Capital Implantado
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatUSD(exposure.totalCapitalDeployed)}
            </p>
            {deployedPct !== null && (
              <p className={`text-xs ${deployedPct > 50 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                {deployedPct.toFixed(1)}% do total
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Exposição Alavancada
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatUSD(exposure.totalLeverageExposure)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Capital em Risco
            </p>
            <p className={`text-sm font-bold ${atRiskPct && atRiskPct > 10 ? 'text-destructive' : 'text-foreground'}`}>
              {formatUSD(capitalAtRisk)}
            </p>
            {atRiskPct !== null && (
              <p className={`text-xs ${atRiskPct > 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {atRiskPct.toFixed(1)}% do total
              </p>
            )}
          </div>
        </div>

        {/* Exposure Chart */}
        <ExposureChart
          exposureByAsset={exposure.exposureByAsset}
          longShortBalance={exposure.longShortBalance}
          totalCapital={totalCapital ?? exposure.totalCapitalDeployed}
        />

        {/* Correlation Warnings */}
        {exposure.warningFlags.highExposure && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Alta exposição alavancada detectada. Considere reduzir o tamanho das posições.</p>
          </div>
        )}
        {exposure.warningFlags.highCorrelation && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Múltiplas posições correlacionadas detectadas. Diversificação recomendada.</p>
          </div>
        )}
        {exposure.warningFlags.imbalancedPositions && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Portfólio muito inclinado para uma direção. Considere fazer hedge.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioExposureDashboard;
