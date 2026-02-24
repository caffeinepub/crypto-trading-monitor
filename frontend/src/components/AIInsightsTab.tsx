import { PositionWithPrice } from '../types/position';
import { SentimentGauge } from './SentimentGauge';
import { TrendPredictionCard } from './TrendPredictionCard';
import { AdjustmentSuggestionCard } from './AdjustmentSuggestionCard';
import { useAdjustmentSuggestions } from '../hooks/useAdjustmentSuggestions';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';

interface AIInsightsTabProps {
  positions: PositionWithPrice[];
  onUpdatePosition: (id: string, updates: Partial<PositionWithPrice>) => void;
}

function PositionInsights({
  position,
  onUpdatePosition,
}: {
  position: PositionWithPrice;
  onUpdatePosition: (id: string, updates: Partial<PositionWithPrice>) => void;
}) {
  const { data: allSuggestions } = useAdjustmentSuggestions([position]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const activeSuggestions = (allSuggestions || []).filter(
    (s) => !dismissedSuggestions.has(`${s.positionId}-${s.type}-${s.timestamp}`)
  );

  const handleAcceptSuggestion = (suggestion: any) => {
    if (suggestion.type === 'stop-loss') {
      onUpdatePosition(position.id, {
        stopLoss: {
          ...position.stopLoss,
          price: suggestion.proposedLevel,
        },
      });
    } else if (suggestion.type === 'take-profit') {
      const updatedLevels = [...position.takeProfitLevels];
      if (updatedLevels[0]) {
        updatedLevels[0] = {
          ...updatedLevels[0],
          price: suggestion.proposedLevel,
        };
      }
      onUpdatePosition(position.id, {
        takeProfitLevels: updatedLevels,
      });
    }
    setDismissedSuggestions((prev) =>
      new Set(prev).add(`${suggestion.positionId}-${suggestion.type}-${suggestion.timestamp}`)
    );
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(suggestionId));
  };

  return (
    <div className="space-y-4">
      {/* Position heading */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-8 rounded-full bg-primary" />
        <div>
          <h2 className="text-xl font-bold text-primary">{position.symbol}</h2>
          <p className="text-xs text-muted-foreground">
            {position.positionType} · {position.leverage}x · Entry ${position.entryPrice.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Adjustment Suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="space-y-2">
          {activeSuggestions.map((suggestion) => (
            <AdjustmentSuggestionCard
              key={`${suggestion.positionId}-${suggestion.type}-${suggestion.timestamp}`}
              suggestion={suggestion}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
            />
          ))}
        </div>
      )}

      {/* Sentiment & Trend */}
      <div className="grid md:grid-cols-2 gap-4">
        <SentimentGauge symbol={position.symbol} />
        <TrendPredictionCard symbol={position.symbol} />
      </div>
    </div>
  );
}

export function AIInsightsTab({ positions, onUpdatePosition }: AIInsightsTabProps) {
  if (positions.length === 0) {
    return (
      <Card className="border-primary/30 shadow-xl bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="py-16 text-center">
          <Brain className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold mb-2">No Positions to Analyze</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add a position from the{' '}
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </span>{' '}
            tab to see AI insights, sentiment analysis, and trend predictions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {positions.map((position) => (
        <div
          key={position.id}
          className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-5 space-y-4"
        >
          <PositionInsights position={position} onUpdatePosition={onUpdatePosition} />
        </div>
      ))}
    </div>
  );
}
