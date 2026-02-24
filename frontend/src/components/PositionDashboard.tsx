import { Position } from '../types/position';
import { usePositionMonitoring } from '../hooks/usePositionMonitoring';
import { PositionCard } from './PositionCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PositionDashboardProps {
  positions: Position[];
  onUpdate: (id: string, updates: Partial<Position>) => void;
  onDelete: (id: string) => void;
}

export function PositionDashboard({ positions, onUpdate, onDelete }: PositionDashboardProps) {
  const { data: positionsWithPrice, isLoading, error } = usePositionMonitoring(positions);

  if (positions.length === 0) {
    return (
      <Card className="shadow-xl border-primary/30 relative overflow-hidden">
        {/* Chart Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: 'url(/assets/generated/chart-pattern-overlay.dim_800x600.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        <div className="relative z-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-primary to-accent rounded-md">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Active Positions
              </span>
            </CardTitle>
            <CardDescription>Monitor your trading positions in real-time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-4 golden-glow">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Active Positions</h3>
              <p className="text-muted-foreground">
                Use the <span className="text-primary font-medium">Import from Binance</span> button above to sync your open positions automatically.
              </p>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-primary to-accent rounded-md">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            Active Positions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {positions.length} position{positions.length !== 1 ? 's' : ''} monitored
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to fetch price data. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !positionsWithPrice ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {positionsWithPrice?.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              onDelete={() => onDelete(position.id)}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
