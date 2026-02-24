import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Edit2, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { getTotalCapital } from '../utils/totalCapitalStorage';
import { TotalCapitalInput } from './TotalCapitalInput';
import { PositionWithPrice } from '../types/position';

interface TotalCapitalSummaryProps {
  positions: PositionWithPrice[];
}

export function TotalCapitalSummary({ positions }: TotalCapitalSummaryProps) {
  const [totalCapital, setTotalCapital] = useState<number | null>(getTotalCapital());
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCapitalUpdate = (newValue: number) => {
    setTotalCapital(newValue);
    setDialogOpen(false);
  };

  // Calculate deployed capital (sum of all position investments)
  const deployedCapital = positions.reduce((sum, pos) => sum + pos.investmentAmount, 0);

  // Calculate capital at risk (sum of potential losses to stop-loss)
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

  // Calculate available capital
  const availableCapital = totalCapital ? totalCapital - deployedCapital : 0;

  if (!totalCapital) {
    return (
      <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Total Capital
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              Set your total trading capital to track risk percentages and portfolio metrics
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Set Total Capital
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
        </CardContent>
      </Card>
    );
  }

  const deployedPercent = (deployedCapital / totalCapital) * 100;
  const riskPercent = (capitalAtRisk / totalCapital) * 100;
  const availablePercent = (availableCapital / totalCapital) * 100;

  return (
    <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Capital Overview
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Edit2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Total Trading Capital</DialogTitle>
              </DialogHeader>
              <TotalCapitalInput onSave={handleCapitalUpdate} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Capital */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Total Capital
            </p>
            <p className="text-xl font-bold text-primary">
              ${totalCapital.toLocaleString()}
            </p>
          </div>

          {/* Deployed Capital */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Deployed
            </p>
            <p className="text-xl font-bold">
              ${deployedCapital.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {deployedPercent.toFixed(1)}% of total
            </p>
          </div>

          {/* Capital at Risk */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              At Risk
            </p>
            <p className="text-xl font-bold text-destructive">
              ${capitalAtRisk.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {riskPercent.toFixed(1)}% of total
            </p>
          </div>

          {/* Available Capital */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Available
            </p>
            <p className="text-xl font-bold text-chart-1">
              ${availableCapital.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {availablePercent.toFixed(1)}% of total
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
