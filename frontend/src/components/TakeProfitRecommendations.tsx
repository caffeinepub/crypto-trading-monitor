import { TakeProfitLevel, PositionType } from '../types/position';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';

interface TakeProfitRecommendationsProps {
  levels: TakeProfitLevel[];
  currentPrice: number;
  positionType: PositionType;
}

export function TakeProfitRecommendations({ levels, currentPrice, positionType }: TakeProfitRecommendationsProps) {
  const getDistancePercent = (targetPrice: number) => {
    return ((targetPrice - currentPrice) / currentPrice) * 100;
  };

  const isReached = (targetPrice: number) => {
    if (positionType === 'Long') {
      return currentPrice >= targetPrice;
    } else {
      return currentPrice <= targetPrice;
    }
  };

  return (
    <div className="space-y-3">
      {levels.map((level) => {
        const distance = getDistancePercent(level.price);
        const reached = isReached(level.price);

        return (
          <Card key={level.level} className={`${reached ? 'bg-chart-1/10 border-chart-1' : 'bg-card'}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${reached ? 'text-chart-1' : 'text-muted-foreground'}`} />
                  <span className="font-semibold">TP{level.level}</span>
                  {reached && <Badge variant="default" className="bg-chart-1">Reached</Badge>}
                </div>
                <div className="text-right">
                  <div className="font-bold">${level.price.toFixed(4)}</div>
                  <div className={`text-xs ${Math.abs(distance) < 2 ? 'text-chart-1 font-semibold' : 'text-muted-foreground'}`}>
                    {positionType === 'Long' ? (
                      distance > 0 ? `↑ ${distance.toFixed(2)}%` : `↓ ${Math.abs(distance).toFixed(2)}%`
                    ) : (
                      distance < 0 ? `↓ ${Math.abs(distance).toFixed(2)}%` : `↑ ${distance.toFixed(2)}%`
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Profit</span>
                <div className="text-right">
                  <div className="font-semibold text-chart-1">
                    +${level.profitUSD.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    +{level.profitPercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {level.reasoning}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
