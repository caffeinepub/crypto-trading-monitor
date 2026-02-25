import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { AdjustmentSuggestion, AdjustmentType } from '@/types/adjustment';

interface AdjustmentSuggestionCardProps {
  suggestion: AdjustmentSuggestion;
  onAccept?: (suggestion: AdjustmentSuggestion) => void;
  onDismiss?: (suggestion: AdjustmentSuggestion) => void;
}

function getTypeLabel(type: AdjustmentType): string {
  if (type === 'take-profit') return 'Take Profit';
  if (type === 'stop-loss') return 'Stop Loss';
  return type;
}

export function AdjustmentSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: AdjustmentSuggestionCardProps) {
  const isTP = suggestion.type === 'take-profit';
  const isSL = suggestion.type === 'stop-loss';

  const getTypeIcon = () => {
    if (isTP) return <TrendingUp className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  };

  const getConfidenceBadgeVariant = (confidence: number): 'default' | 'secondary' | 'outline' => {
    if (confidence >= 75) return 'default';
    if (confidence >= 50) return 'secondary';
    return 'outline';
  };

  // Access fields that may exist on the suggestion object
  const s = suggestion as any;
  const symbolDisplay: string = s.symbol || s.positionSymbol || '';
  const currentLevel: number | undefined = suggestion.currentLevel;
  const proposedLevel: number | undefined = suggestion.proposedLevel;
  const reasoning: string = suggestion.reasoning || '';
  const confidence: number = suggestion.confidence ?? 50;

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            <CardTitle className="text-sm font-semibold">
              {symbolDisplay && `${symbolDisplay} — `}{getTypeLabel(suggestion.type)}
            </CardTitle>
          </div>
          <Badge variant={getConfidenceBadgeVariant(confidence)}>
            {confidence}% confiança
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground mb-1">Nível Atual</p>
            <p className="font-mono font-semibold">
              {currentLevel != null
                ? `$${currentLevel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                : '—'}
            </p>
          </div>
          <div className="rounded-md bg-primary/10 p-2 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Nível Proposto</p>
            <p className="font-mono font-semibold text-primary">
              {proposedLevel != null
                ? `$${proposedLevel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                : '—'}
            </p>
          </div>
        </div>

        {reasoning && (
          <div className="rounded-md bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground mb-1">Raciocínio</p>
            <p className="text-xs leading-relaxed">{reasoning}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1"
            onClick={() => onAccept?.(suggestion)}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1"
            onClick={() => onDismiss?.(suggestion)}
          >
            <XCircle className="h-3.5 w-3.5" />
            Recusar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdjustmentSuggestionCard;
