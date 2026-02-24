import { UserTradeRecord, AITradeRecord, PerformanceMetrics, ModalityStats } from '../types/tradeHistory';

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return (wins / total) * 100;
}

export function calculateTotalPnL(records: Array<{ pnlUsd: number }>): number {
  return records.reduce((sum, r) => sum + r.pnlUsd, 0);
}

export function calculateUserPerformance(records: UserTradeRecord[]): PerformanceMetrics {
  const total = records.length;
  const wins = records.filter((r) => r.outcome === 'TP Hit').length;
  const winRate = calculateWinRate(wins, total);
  const totalPnlUsd = calculateTotalPnL(records);

  return { totalTrades: total, wins, winRate, totalPnlUsd };
}

export function calculateAIPerformance(records: AITradeRecord[]): PerformanceMetrics {
  const total = records.length;
  const wins = records.filter((r) => r.outcome === 'TP Hit').length;
  const winRate = calculateWinRate(wins, total);
  const totalPnlUsd = calculateTotalPnL(records);

  // Per-modality breakdown
  const modalityMap: Record<string, { wins: number; total: number; pnl: number }> = {};
  for (const record of records) {
    if (!modalityMap[record.modality]) {
      modalityMap[record.modality] = { wins: 0, total: 0, pnl: 0 };
    }
    modalityMap[record.modality].total += 1;
    modalityMap[record.modality].pnl += record.pnlUsd;
    if (record.outcome === 'TP Hit') {
      modalityMap[record.modality].wins += 1;
    }
  }

  const modalityBreakdown: ModalityStats[] = Object.entries(modalityMap).map(
    ([modality, stats]) => ({
      modality,
      totalTrades: stats.total,
      wins: stats.wins,
      winRate: calculateWinRate(stats.wins, stats.total),
      totalPnl: stats.pnl,
    })
  );

  // Sort by modality name for consistent display
  const modalityOrder = ['Scalping', 'DayTrading', 'SwingTrading', 'TrendFollowing'];
  modalityBreakdown.sort(
    (a, b) => modalityOrder.indexOf(a.modality) - modalityOrder.indexOf(b.modality)
  );

  return { totalTrades: total, wins, winRate, totalPnlUsd, modalityBreakdown };
}
