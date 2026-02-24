import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PositionWithPrice } from '../types/position';
import { UserTradeRecord, TradeOutcome } from '../types/tradeHistory';
import { calculatePnL } from '../utils/pnlCalculations';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

interface TradeOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: PositionWithPrice;
  onSave: (record: UserTradeRecord) => void;
}

const OUTCOME_OPTIONS: { value: TradeOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'TP Hit',
    label: 'Take Profit Hit',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
  {
    value: 'SL Hit',
    label: 'Stop Loss Hit',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-destructive',
  },
  {
    value: 'Manually Closed',
    label: 'Manually Closed',
    icon: <MinusCircle className="w-4 h-4" />,
    color: 'text-primary',
  },
];

export function TradeOutcomeModal({ isOpen, onClose, position, onSave }: TradeOutcomeModalProps) {
  const [outcome, setOutcome] = useState<TradeOutcome>('Manually Closed');
  const [exitPriceStr, setExitPriceStr] = useState(position.currentPrice.toFixed(4));
  const [error, setError] = useState('');

  const handleSave = () => {
    const exitPrice = parseFloat(exitPriceStr);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      setError('Please enter a valid exit price.');
      return;
    }

    const { pnlUSD, pnlPercent } = calculatePnL(
      position.entryPrice,
      exitPrice,
      position.investmentAmount,
      position.leverage,
      position.positionType
    );

    const record: UserTradeRecord = {
      id: `user-${position.id}-${Date.now()}`,
      symbol: position.symbol,
      positionType: position.positionType,
      entryPrice: position.entryPrice,
      exitPrice,
      investment: position.investmentAmount,
      pnlUsd: pnlUSD,
      pnlPercent,
      outcome,
      timestamp: Date.now(),
    };

    onSave(record);
    onClose();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const exitPrice = parseFloat(exitPriceStr);
  const previewPnl =
    !isNaN(exitPrice) && exitPrice > 0
      ? calculatePnL(
          position.entryPrice,
          exitPrice,
          position.investmentAmount,
          position.leverage,
          position.positionType
        )
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Close Position — {position.symbol}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Record the outcome of this trade to track your performance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Outcome Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Trade Outcome</Label>
            <RadioGroup
              value={outcome}
              onValueChange={(v) => setOutcome(v as TradeOutcome)}
              className="space-y-2"
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    outcome === opt.value
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                  }`}
                  onClick={() => setOutcome(opt.value)}
                >
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label
                    htmlFor={opt.value}
                    className={`flex items-center gap-2 cursor-pointer font-medium ${opt.color}`}
                  >
                    {opt.icon}
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Exit Price */}
          <div className="space-y-2">
            <Label htmlFor="exit-price" className="text-sm font-medium text-foreground">
              Exit Price (USDT)
            </Label>
            <Input
              id="exit-price"
              type="number"
              step="any"
              value={exitPriceStr}
              onChange={(e) => {
                setExitPriceStr(e.target.value);
                setError('');
              }}
              className="border-primary/30 focus:border-primary bg-muted/20"
              placeholder="Enter exit price"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* PnL Preview */}
          {previewPnl && (
            <div
              className={`p-3 rounded-lg border text-sm ${
                previewPnl.pnlUSD >= 0
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-destructive/10 border-destructive/30'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estimated PnL</span>
                <span
                  className={`font-bold ${
                    previewPnl.pnlUSD >= 0 ? 'text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {previewPnl.pnlUSD >= 0 ? '+' : ''}
                  {previewPnl.pnlUSD.toFixed(2)} USDT ({previewPnl.pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="border-border/50">
            Cancel (don't save)
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Save & Close Position
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
