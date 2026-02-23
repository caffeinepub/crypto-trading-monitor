import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBinancePairs } from '../hooks/useBinancePairs';
import { Position, PositionType } from '../types/position';
import { calculateTakeProfitLevels } from '../utils/takeProfitCalculator';
import { calculateStopLoss } from '../utils/stopLossCalculator';
import { fetchKlines } from '../services/binanceApi';
import { Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PositionEntryFormProps {
  onSubmit: (position: Position) => void;
  onCancel: () => void;
}

export function PositionEntryForm({ onSubmit, onCancel }: PositionEntryFormProps) {
  const { data: pairs, isLoading: pairsLoading, error: pairsError } = useBinancePairs();
  
  const [symbol, setSymbol] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('Long');
  const [leverage, setLeverage] = useState(10);
  const [entryPrice, setEntryPrice] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const totalExposure = parseFloat(investmentAmount || '0') * leverage;

  const filteredPairs = pairs?.filter(pair => 
    pair.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!symbol || !entryPrice || !investmentAmount) {
      setError('Please fill in all required fields');
      return;
    }

    const entryPriceNum = parseFloat(entryPrice);
    const investmentAmountNum = parseFloat(investmentAmount);

    if (isNaN(entryPriceNum) || entryPriceNum <= 0) {
      setError('Entry price must be a positive number');
      return;
    }

    if (isNaN(investmentAmountNum) || investmentAmountNum <= 0) {
      setError('Investment amount must be a positive number');
      return;
    }

    setIsSubmitting(true);

    try {
      // Fetch historical data for technical analysis
      const historicalPrices = await fetchKlines(symbol, '1h', 100);
      
      if (historicalPrices.length === 0) {
        throw new Error('Unable to fetch historical data for analysis');
      }

      const takeProfitLevels = await calculateTakeProfitLevels(
        symbol,
        entryPriceNum,
        investmentAmountNum,
        leverage,
        positionType,
        historicalPrices
      );

      const stopLoss = await calculateStopLoss(
        symbol,
        entryPriceNum,
        investmentAmountNum,
        leverage,
        positionType,
        historicalPrices
      );

      const position: Position = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        positionType,
        leverage,
        entryPrice: entryPriceNum,
        investmentAmount: investmentAmountNum,
        totalExposure,
        takeProfitLevels,
        stopLoss,
        timestamp: Date.now(),
      };

      onSubmit(position);

      // Reset form
      setSymbol('');
      setEntryPrice('');
      setInvestmentAmount('');
      setLeverage(10);
      setSearchTerm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-chart-1" />
          New Position
        </CardTitle>
        <CardDescription>Enter your trading position details for AI-powered analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {pairsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load trading pairs. Please check your connection.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="symbol">Trading Pair</Label>
            <div className="space-y-2">
              <Input
                id="search"
                placeholder="Search pairs (e.g., BTCUSDT)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={pairsLoading}
              />
              <Select value={symbol} onValueChange={setSymbol} disabled={pairsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={pairsLoading ? 'Loading pairs...' : 'Select a trading pair'} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {filteredPairs.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Position Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={positionType === 'Long' ? 'default' : 'outline'}
                className={positionType === 'Long' ? 'bg-chart-1 hover:bg-chart-1/90' : ''}
                onClick={() => setPositionType('Long')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Long
              </Button>
              <Button
                type="button"
                variant={positionType === 'Short' ? 'default' : 'outline'}
                className={positionType === 'Short' ? 'bg-destructive hover:bg-destructive/90' : ''}
                onClick={() => setPositionType('Short')}
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Short
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="leverage">Leverage</Label>
              <Badge variant="secondary">{leverage}x</Badge>
            </div>
            <Slider
              id="leverage"
              min={1}
              max={125}
              step={1}
              value={[leverage]}
              onValueChange={(value) => setLeverage(value[0])}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span>125x</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entryPrice">Entry Price (USD)</Label>
            <Input
              id="entryPrice"
              type="number"
              step="any"
              placeholder="0.00"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="investmentAmount">Investment Amount (USD)</Label>
            <Input
              id="investmentAmount"
              type="number"
              step="any"
              placeholder="0.00"
              value={investmentAmount}
              onChange={(e) => setInvestmentAmount(e.target.value)}
            />
          </div>

          <div className="p-4 bg-accent/50 rounded-lg border border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Exposure</span>
              <span className="text-lg font-bold">${totalExposure.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Investment × Leverage = ${investmentAmount || '0'} × {leverage}x
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting || pairsLoading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Create Position'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
