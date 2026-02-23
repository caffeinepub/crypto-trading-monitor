import { ExposureByAsset, LongShortBalance } from '../types/exposure';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ExposureChartProps {
  exposureByAsset: ExposureByAsset[];
  longShortBalance: LongShortBalance;
  totalCapital: number;
}

export function ExposureChart({ exposureByAsset, longShortBalance, totalCapital }: ExposureChartProps) {
  const longPercentage = totalCapital > 0 ? (longShortBalance.longCapital / totalCapital) * 100 : 0;
  const shortPercentage = totalCapital > 0 ? (longShortBalance.shortCapital / totalCapital) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Asset Allocation */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {exposureByAsset.map((asset, index) => (
            <div key={asset.symbol} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{asset.symbol}</span>
                <span className="text-muted-foreground">
                  {asset.percentage.toFixed(1)}% (${asset.capitalDeployed.toFixed(0)})
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${asset.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Long/Short Balance */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Long/Short Balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-chart-1" />
                  <span className="font-medium">Long</span>
                </div>
                <span className="text-muted-foreground">
                  {longShortBalance.longCount} ({longPercentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-chart-1 transition-all"
                  style={{ width: `${longPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <span className="font-medium">Short</span>
                </div>
                <span className="text-muted-foreground">
                  {longShortBalance.shortCount} ({shortPercentage.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${shortPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
