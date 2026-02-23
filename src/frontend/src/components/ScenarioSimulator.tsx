import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { PositionWithPrice } from '../types/position';
import { simulateScenario, SCENARIO_PRESETS } from '../utils/scenarioSimulator';
import { ScenarioResult } from '../types/scenario';

interface ScenarioSimulatorProps {
  positions: PositionWithPrice[];
}

export function ScenarioSimulator({ positions }: ScenarioSimulatorProps) {
  const [percentageChange, setPercentageChange] = useState<number>(0);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const runSimulation = (change: number) => {
    setPercentageChange(change);
    if (positions.length > 0) {
      const simResult = simulateScenario(positions, change);
      setResult(simResult);
    }
  };

  const handleSliderChange = (value: number[]) => {
    runSimulation(value[0]);
  };

  const handlePresetClick = (change: number) => {
    runSimulation(change);
  };

  const hasLiquidationRisk = result?.positionOutcomes.some(o => o.liquidationRisk) || false;

  return (
    <Card className="border-primary/30 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Scenario Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset Scenarios */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Quick Scenarios</p>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIO_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset.percentageChange)}
                className="justify-start"
              >
                {preset.percentageChange > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-2 text-chart-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-2 text-destructive" />
                )}
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Custom Price Change</p>
            <Badge variant={percentageChange >= 0 ? 'default' : 'destructive'} className={percentageChange >= 0 ? 'bg-chart-1 hover:bg-chart-1/90' : ''}>
              {percentageChange > 0 ? '+' : ''}{percentageChange}%
            </Badge>
          </div>
          <Slider
            value={[percentageChange]}
            onValueChange={handleSliderChange}
            min={-50}
            max={50}
            step={1}
            className="py-2"
          />
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2">
            {/* Total Impact */}
            <div className={`p-4 rounded-lg border ${
              result.totalImpactUSD >= 0
                ? 'bg-chart-1/10 border-chart-1/30'
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <p className="text-sm text-muted-foreground mb-2">Total Portfolio Impact</p>
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold ${
                  result.totalImpactUSD >= 0 ? 'text-chart-1' : 'text-destructive'
                }`}>
                  {result.totalImpactUSD >= 0 ? '+' : ''}${result.totalImpactUSD.toFixed(2)}
                </span>
                <Badge
                  variant={result.totalImpactUSD >= 0 ? 'default' : 'destructive'}
                  className={`text-lg ${result.totalImpactUSD >= 0 ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
                >
                  {result.totalImpactPercent >= 0 ? '+' : ''}{result.totalImpactPercent.toFixed(2)}%
                </Badge>
              </div>
            </div>

            {/* Liquidation Warning */}
            {hasLiquidationRisk && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  ⚠️ Warning: Some positions face liquidation risk in this scenario!
                </AlertDescription>
              </Alert>
            )}

            {/* Individual Position Outcomes */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Position Outcomes</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.positionOutcomes.map((outcome) => (
                  <div
                    key={outcome.positionId}
                    className={`p-3 rounded-lg border ${
                      outcome.liquidationRisk
                        ? 'bg-destructive/20 border-destructive'
                        : outcome.projectedPnL >= 0
                        ? 'bg-chart-1/10 border-chart-1/30'
                        : 'bg-destructive/10 border-destructive/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{outcome.symbol}</span>
                      <div className="flex items-center gap-2">
                        {outcome.tpHit && (
                          <Badge variant="default" className="text-xs bg-chart-1 hover:bg-chart-1/90">
                            TP Hit
                          </Badge>
                        )}
                        {outcome.slHit && (
                          <Badge variant="destructive" className="text-xs">
                            SL Hit
                          </Badge>
                        )}
                        {outcome.liquidationRisk && (
                          <Badge variant="destructive" className="text-xs">
                            Liquidation Risk
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        ${outcome.simulatedPrice.toFixed(4)}
                      </span>
                      <span className={`font-bold ${
                        outcome.projectedPnL >= 0 ? 'text-chart-1' : 'text-destructive'
                      }`}>
                        {outcome.projectedPnL >= 0 ? '+' : ''}${outcome.projectedPnL.toFixed(2)} ({outcome.projectedPnLPercent >= 0 ? '+' : ''}{outcome.projectedPnLPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
