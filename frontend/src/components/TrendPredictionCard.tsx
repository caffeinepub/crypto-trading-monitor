import { useTrendPrediction } from '../hooks/useTrendPrediction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Loader2, Sparkles } from 'lucide-react';

interface TrendPredictionCardProps {
  symbol: string;
}

export function TrendPredictionCard({ symbol }: TrendPredictionCardProps) {
  const { data: predictions, isLoading } = useTrendPrediction(symbol);

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!predictions) return null;

  const getDirectionIcon = (direction: string) => {
    if (direction === 'up') return <TrendingUp className="w-5 h-5" />;
    if (direction === 'down') return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getDirectionColor = (direction: string) => {
    if (direction === 'up') return 'text-chart-1';
    if (direction === 'down') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'up') return 'default';
    if (direction === 'down') return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Trend Predictions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Short-term prediction */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {predictions.shortTerm.timeLabel}
            </span>
            <Badge variant="outline" className="text-xs">
              {predictions.shortTerm.confidence}% confidence
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getDirectionColor(predictions.shortTerm.direction)}`}>
              {getDirectionIcon(predictions.shortTerm.direction)}
            </div>
            <div className="flex-1">
              <Badge
                variant={getDirectionBadge(predictions.shortTerm.direction) as any}
                className={`font-bold ${predictions.shortTerm.direction === 'up' ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
              >
                {predictions.shortTerm.direction.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Medium-term prediction */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {predictions.mediumTerm.timeLabel}
            </span>
            <Badge variant="outline" className="text-xs">
              {predictions.mediumTerm.confidence}% confidence
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getDirectionColor(predictions.mediumTerm.direction)}`}>
              {getDirectionIcon(predictions.mediumTerm.direction)}
            </div>
            <div className="flex-1">
              <Badge
                variant={getDirectionBadge(predictions.mediumTerm.direction) as any}
                className={`font-bold ${predictions.mediumTerm.direction === 'up' ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
              >
                {predictions.mediumTerm.direction.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
