import { useState } from 'react';
import { AdjustmentSuggestion } from '../types/adjustment';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Check, X, Lightbulb } from 'lucide-react';

interface AdjustmentSuggestionCardProps {
  suggestion: AdjustmentSuggestion;
  onAccept: (suggestion: AdjustmentSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
}

export function AdjustmentSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: AdjustmentSuggestionCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    await onAccept(suggestion);
    setIsProcessing(false);
  };

  const handleDismiss = () => {
    onDismiss(`${suggestion.positionId}-${suggestion.type}-${suggestion.timestamp}`);
  };

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Lightbulb className="h-4 w-4 text-primary" />
      <AlertDescription className="space-y-3 ml-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {suggestion.type === 'take-profit' ? 'Take Profit' : 'Stop Loss'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {suggestion.confidence}% confidence
              </Badge>
            </div>
            <p className="text-sm text-foreground mb-2">{suggestion.reasoning}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className="font-mono font-medium">${suggestion.currentLevel.toFixed(4)}</span>
          <ArrowRight className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Suggested:</span>
          <span className="font-mono font-medium text-primary">${suggestion.proposedLevel.toFixed(4)}</span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Accept
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            disabled={isProcessing}
          >
            <X className="w-3 h-3 mr-1" />
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
