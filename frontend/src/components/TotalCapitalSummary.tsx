import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, TrendingUp, Shield, Wallet, Edit2, Check, X } from 'lucide-react';
import { getTotalCapital, setTotalCapital, validateTotalCapital } from '../utils/totalCapitalStorage';
import { PositionWithPrice } from '../types/position';

interface TotalCapitalSummaryProps {
  positions: PositionWithPrice[];
}

export function TotalCapitalSummary({ positions }: TotalCapitalSummaryProps) {
  // Reactive total capital — updates immediately when capital is changed elsewhere
  // Listens to 'total-capital-change' custom DOM event
  const [totalCapital, setTotalCapitalState] = useState<number | null>(() => getTotalCapital());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const handler = () => {
      setTotalCapitalState(getTotalCapital());
    };

    window.addEventListener('total-capital-change', handler);

    return () => {
      window.removeEventListener('total-capital-change', handler);
    };
  }, []); // Empty dependency array — register once only

  // Calculate deployed capital (sum of all position investments)
  const deployedCapital = positions.reduce((sum, pos) => sum + pos.investmentAmount, 0);

  // Calculate capital at risk (sum of potential losses to stop-loss)
  // Position uses stopLoss: StopLossRecommendation (object with .price)
  const capitalAtRisk = positions.reduce((sum, pos) => {
    if (!pos.stopLoss || typeof pos.stopLoss !== 'object') return sum;
    const slPrice = pos.stopLoss.price;
    const priceDiff = pos.positionType === 'Long'
      ? pos.entryPrice - slPrice
      : slPrice - pos.entryPrice;
    const lossPercent = Math.abs(priceDiff / pos.entryPrice);
    return sum + pos.investmentAmount * pos.leverage * lossPercent;
  }, 0);

  // Calculate available capital
  const availableCapital = totalCapital !== null ? Math.max(0, totalCapital - deployedCapital) : null;

  const handleEditStart = useCallback(() => {
    setEditValue(totalCapital !== null ? totalCapital.toString() : '');
    setIsEditing(true);
  }, [totalCapital]);

  const handleEditSave = useCallback(() => {
    const value = parseFloat(editValue);
    if (validateTotalCapital(value)) {
      setTotalCapital(value);
      setTotalCapitalState(value);
      setIsEditing(false);
    }
  }, [editValue]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const formatUSD = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const deployedPct = totalCapital ? (deployedCapital / totalCapital) * 100 : null;
  const atRiskPct = totalCapital ? (capitalAtRisk / totalCapital) * 100 : null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Resumo de Capital
          </CardTitle>
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditStart}
              className="w-6 h-6 text-muted-foreground hover:text-foreground"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalCapital === null && !isEditing ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Configure seu capital total para ver métricas de exposição
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditStart}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              Definir Capital Total
            </Button>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Ex: 10000"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSave();
                if (e.key === 'Escape') handleEditCancel();
              }}
            />
            <Button size="icon" variant="ghost" onClick={handleEditSave} className="w-7 h-7 text-green-500">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleEditCancel} className="w-7 h-7 text-destructive">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wallet className="w-3 h-3" />
                Total
              </div>
              <p className="text-sm font-bold text-foreground">
                {totalCapital !== null ? formatUSD(totalCapital) : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                Implantado
              </div>
              <p className={`text-sm font-bold ${deployedPct && deployedPct > 50 ? 'text-amber-400' : 'text-foreground'}`}>
                {formatUSD(deployedCapital)}
                {deployedPct !== null && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({deployedPct.toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                Em Risco
              </div>
              <p className={`text-sm font-bold ${atRiskPct && atRiskPct > 10 ? 'text-destructive' : 'text-foreground'}`}>
                {formatUSD(capitalAtRisk)}
                {atRiskPct !== null && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({atRiskPct.toFixed(1)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                Disponível
              </div>
              <p className="text-sm font-bold text-foreground">
                {availableCapital !== null ? formatUSD(availableCapital) : '—'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TotalCapitalSummary;
