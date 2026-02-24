import { AIDailyTradesSection } from './AIDailyTradesSection';
import { PerformanceComparisonPanel } from './PerformanceComparisonPanel';

export function AIDailyTradesTab() {
  return (
    <div className="space-y-6">
      <AIDailyTradesSection />
      <PerformanceComparisonPanel />
    </div>
  );
}
