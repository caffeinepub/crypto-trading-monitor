import { StopLossRecommendation, PositionType } from '../types/position';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StopLossRecommendationsProps {
  stopLoss: StopLossRecommendation;
  currentPrice: number;
  positionType: PositionType;
}

export function StopLossRecommendations({ stopLoss, currentPrice, positionType }: StopLossRecommendationsProps) {
  const getDistancePercent = () => {
    return ((stopLoss.price - currentPrice) / currentPrice) * 100;
  };

  const distance = getDistancePercent();
  const isNear = Math.abs(distance) < 2;

  return (
    <div className="space-y-3">
      <Card className={`${isNear ? 'bg-destructive/10 border-destructive' : 'bg-card'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${isNear ? 'text-destructive' : 'text-muted-foreground'}`} />
              <span className="font-semibold">Stop Loss</span>
              {isNear && (
                <Badge variant="destructive" className="animate-pulse">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Near SL
                </Badge>
              )}
            </div>
            <div className="text-right">
              <div className="font-bold">${stopLoss.price.toFixed(4)}</div>
              <div className={`text-xs ${isNear ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                {positionType === 'Long' ? (
                  distance < 0 ? `↓ ${Math.abs(distance).toFixed(2)}%` : `↑ ${distance.toFixed(2)}%`
                ) : (
                  distance > 0 ? `↑ ${distance.toFixed(2)}%` : `↓ ${Math.abs(distance).toFixed(2)}%`
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Max Loss</div>
              <div className="font-semibold text-destructive">
                -${stopLoss.lossUSD.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                -{stopLoss.lossPercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Capital Risk</div>
              <div className="font-semibold">
                {stopLoss.capitalRiskPercent.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                of investment
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {stopLoss.reasoning}
          </p>

          <Alert className="bg-accent/50 border-border/50">
            <AlertDescription className="text-xs leading-relaxed">
              <strong className="font-semibold">Partial Taking Strategy:</strong>
              <br />
              {stopLoss.partialTakingStrategy}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
