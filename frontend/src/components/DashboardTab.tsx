import { PositionEntryForm } from './PositionEntryForm';
import { PositionDashboard } from './PositionDashboard';
import { TotalCapitalSummary } from './TotalCapitalSummary';
import { Position } from '../types/position';
import { PositionWithPrice } from '../types/position';

interface DashboardTabProps {
  positions: Position[];
  positionsWithPrice: PositionWithPrice[];
  onAddPosition: (position: Position) => void;
  onUpdatePosition: (id: string, updates: Partial<PositionWithPrice>) => void;
  onDeletePosition: (id: string) => void;
}

export function DashboardTab({
  positions,
  positionsWithPrice,
  onAddPosition,
  onUpdatePosition,
  onDeletePosition,
}: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Capital Overview */}
      <TotalCapitalSummary positions={positionsWithPrice} />

      {/* Position Entry Form */}
      <PositionEntryForm
        onSubmit={onAddPosition}
        onCancel={() => {}}
      />

      {/* Position Dashboard */}
      <PositionDashboard
        positions={positions}
        onUpdate={onUpdatePosition}
        onDelete={onDeletePosition}
        onAddNew={() => {}}
      />
    </div>
  );
}
