import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PositionWithPrice } from '@/types/position';
import { AdjustmentSuggestion } from '@/types/adjustment';
import { UserTradeRecord } from '@/types/tradeHistory';
import { AdjustmentSuggestionCard } from '@/components/AdjustmentSuggestionCard';
import { TradeOutcomeModal } from '@/components/TradeOutcomeModal';
import { saveUserTrade } from '@/utils/tradeHistoryStorage';

interface PositionCardProps {
  position: PositionWithPrice;
  onDelete: () => void;
  onUpdate?: (id: string, updates: Partial<PositionWithPrice>) => void;
}

export function PositionCard({ position, onDelete, onUpdate }: PositionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [suggestions, setSuggestions] = useState<AdjustmentSuggestion[]>([]);

  const isLong = position.positionType === 'Long';
  const pnlUSD = position.pnlUSD ?? 0;
  const pnlPercent = position.pnlPercent ?? 0;
  const isProfit = pnlUSD >= 0;

  const handleDismissSuggestion = (suggestion: AdjustmentSuggestion) => {
    setSuggestions(prev => prev.filter(s => s !== suggestion));
  };

  const handleDeleteClick = () => {
    setShowOutcomeModal(true);
  };

  const handleOutcomeSave = (record: UserTradeRecord) => {
    saveUserTrade(record);
    setShowOutcomeModal(false);
    onDelete();
  };

  const handleOutcomeClose = () => {
    setShowOutcomeModal(false);
    onDelete();
  };

  const formatPrice = (price: number) =>
    price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const formatPnl = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLong ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="font-semibold text-sm">{position.symbol}</span>
              <Badge variant={isLong ? 'default' : 'destructive'} className="text-xs">
                {isLong ? 'Long' : 'Short'}
              </Badge>
              {position.leverage && (
                <Badge variant="outline" className="text-xs">
                  {position.leverage}x
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Price & Entry */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Preço Atual</p>
              <p className="font-mono font-semibold">
                ${formatPrice(position.currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entrada</p>
              <p className="font-mono font-semibold">
                ${formatPrice(position.entryPrice)}
              </p>
            </div>
          </div>

          {/* PnL */}
          <div
            className={`rounded-md p-2 text-sm ${
              isProfit ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">PnL</span>
              <div className="text-right">
                <span
                  className={`font-semibold font-mono ${
                    isProfit ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {formatPnl(pnlUSD)} USDT
                </span>
                <span
                  className={`ml-2 text-xs ${
                    isProfit ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  ({formatPnl(pnlPercent)}%)
                </span>
              </div>
            </div>
          </div>

          {expanded && (
            <div className="space-y-3 pt-1">
              {/* Take Profit Levels */}
              {position.takeProfitLevels && position.takeProfitLevels.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Take Profit</span>
                  </div>
                  <div className="space-y-1">
                    {position.takeProfitLevels.map((tp, i) => {
                      // Only distanceToTP1 is guaranteed in PositionWithPrice
                      const distance = i === 0 ? position.distanceToTP1 : undefined;
                      return (
                        <div
                          key={i}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="text-muted-foreground">TP{i + 1}</span>
                          <span className="font-mono">${formatPrice(tp.price)}</span>
                          {distance != null && (
                            <span className="text-muted-foreground">
                              {distance > 0 ? '+' : ''}{distance.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stop Loss */}
              {position.stopLoss && (
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Shield className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-medium">Stop Loss</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Preço</span>
                    <span className="font-mono">${formatPrice(position.stopLoss.price)}</span>
                    {position.distanceToSL != null && (
                      <span className="text-muted-foreground">
                        {position.distanceToSL.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Adjustment Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Sugestões de Ajuste
                  </p>
                  {suggestions.map((s, i) => (
                    <AdjustmentSuggestionCard
                      key={i}
                      suggestion={s}
                      onDismiss={handleDismissSuggestion}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TradeOutcomeModal
        isOpen={showOutcomeModal}
        onClose={handleOutcomeClose}
        position={position}
        onSave={handleOutcomeSave}
      />
    </>
  );
}

export default PositionCard;
