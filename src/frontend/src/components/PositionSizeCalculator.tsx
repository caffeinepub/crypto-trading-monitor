import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowRight } from 'lucide-react';
import { calculatePositionSize } from '../utils/positionSizeCalculator';
import { PositionSizeResult } from '../types/calculator';

interface PositionSizeCalculatorProps {
  onApply?: (result: PositionSizeResult & { stopLossPrice: number }) => void;
}

export function PositionSizeCalculator({ onApply }: PositionSizeCalculatorProps) {
  const [capital, setCapital] = useState<string>('10000');
  const [riskPercentage, setRiskPercentage] = useState<number>(2);
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLossPrice, setStopLossPrice] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(10);
  const [result, setResult] = useState<PositionSizeResult | null>(null);

  useEffect(() => {
    const capitalNum = parseFloat(capital);
    const entryNum = parseFloat(entryPrice);
    const slNum = parseFloat(stopLossPrice);

    if (capitalNum > 0 && entryNum > 0 && slNum > 0 && slNum !== entryNum) {
      const calculated = calculatePositionSize({
        capital: capitalNum,
        riskPercentage,
        stopLossPrice: slNum,
        entryPrice: entryNum,
        leverage,
      });
      setResult(calculated);
    } else {
      setResult(null);
    }
  }, [capital, riskPercentage, entryPrice, stopLossPrice, leverage]);

  const handleApply = () => {
    if (result && onApply) {
      onApply({ ...result, stopLossPrice: parseFloat(stopLossPrice) });
    }
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" />
          Position Size Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="capital">Total Capital (USD)</Label>
          <Input
            id="capital"
            type="number"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="10000"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Risk Percentage</Label>
            <span className="text-sm font-medium text-primary">{riskPercentage}%</span>
          </div>
          <Slider
            value={[riskPercentage]}
            onValueChange={(value) => setRiskPercentage(value[0])}
            min={0.5}
            max={10}
            step={0.5}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Recommended: 1-3% per trade
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="entry">Entry Price</Label>
            <Input
              id="entry"
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="50000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sl">Stop Loss Price</Label>
            <Input
              id="sl"
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              placeholder="48000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Leverage</Label>
            <span className="text-sm font-medium text-primary">{leverage}x</span>
          </div>
          <Slider
            value={[leverage]}
            onValueChange={(value) => setLeverage(value[0])}
            min={1}
            max={125}
            step={1}
            className="py-2"
          />
        </div>

        {result && (
          <>
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Position Size</span>
                <span className="text-lg font-bold text-primary">${result.positionSize.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contracts</span>
                <span className="font-medium">{result.contracts.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Amount</span>
                <span className="font-medium text-destructive">${result.riskAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Potential Reward</span>
                <span className="font-medium text-chart-1">${result.rewardAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk:Reward Ratio</span>
                <span className="font-bold text-primary">1:{result.riskRewardRatio.toFixed(2)}</span>
              </div>
            </div>

            {onApply && (
              <Button onClick={handleApply} className="w-full bg-primary hover:bg-primary/90">
                <ArrowRight className="w-4 h-4 mr-2" />
                Apply to Position Form
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
