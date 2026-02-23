import { useSentimentAnalysis } from '../hooks/useSentimentAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SentimentGaugeProps {
  symbol: string;
}

export function SentimentGauge({ symbol }: SentimentGaugeProps) {
  const { data: sentiment, isLoading } = useSentimentAnalysis(symbol);

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!sentiment) return null;

  const getSentimentColor = () => {
    if (sentiment.score === 'bullish') return 'text-chart-1';
    if (sentiment.score === 'bearish') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getSentimentIcon = () => {
    if (sentiment.score === 'bullish') return <TrendingUp className="w-5 h-5" />;
    if (sentiment.score === 'bearish') return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const getSentimentBgColor = () => {
    if (sentiment.score === 'bullish') return 'bg-chart-1/10 border-chart-1/30';
    if (sentiment.score === 'bearish') return 'bg-destructive/10 border-destructive/30';
    return 'bg-muted/50 border-muted';
  };

  return (
    <Card className={`border ${getSentimentBgColor()}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className={getSentimentColor()}>{getSentimentIcon()}</span>
          Market Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge
            variant={sentiment.score === 'bullish' ? 'default' : sentiment.score === 'bearish' ? 'destructive' : 'secondary'}
            className={`text-base font-bold ${sentiment.score === 'bullish' ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
          >
            {sentiment.score.toUpperCase()}
          </Badge>
          <span className={`text-2xl font-bold ${getSentimentColor()}`}>
            {sentiment.strength}%
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Strength</span>
            <span>{sentiment.strength}%</span>
          </div>
          <Progress
            value={sentiment.strength}
            className="h-2"
          />
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Contributing Factors:</p>
          <div className="space-y-1">
            {sentiment.factors.slice(0, 3).map((factor, index) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-0.5 ${
                    factor.impact === 'positive'
                      ? 'text-chart-1'
                      : factor.impact === 'negative'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{factor.indicator}:</span>{' '}
                  <span className="text-muted-foreground">{factor.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
