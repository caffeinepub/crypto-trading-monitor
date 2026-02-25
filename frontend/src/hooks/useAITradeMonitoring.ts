import { useEffect, useRef, useCallback } from 'react';
import { useAITradeStorage } from './useAITradeStorage';
import { fetchCurrentPrice } from '../services/binanceApi';
import { calculatePnl } from '../utils/pnlCalculations';
import { detectMarketReversal } from '../utils/marketReversalDetector';
import { addAITradeRecord } from '../utils/aiTradeHistoryStorage';
import type { AITrade } from '../types/aiTrade';

const POLL_INTERVAL = 5000;

export function useAITradeMonitoring() {
  const { getTrades, saveTrades } = useAITradeStorage();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  const monitorTrades = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const trades = getTrades();
      if (!trades || trades.length === 0) return;

      const updatedTrades: AITrade[] = [];
      let hasChanges = false;

      for (const trade of trades) {
        // Only monitor open trades
        const status = (trade as any).status as string | undefined;
        const isOpen = !status || status === 'Open' || status === 'open' || status === 'active';

        if (!isOpen) {
          updatedTrades.push(trade);
          continue;
        }

        try {
          const currentPrice = await fetchCurrentPrice(trade.symbol);

          if (!currentPrice || currentPrice === 0) {
            updatedTrades.push(trade);
            continue;
          }

          const { pnlUsd, pnlPercent } = calculatePnl(
            trade.entryPrice,
            currentPrice,
            trade.investmentAmount,
            trade.leverage,
            trade.positionType
          );

          // Check TP hits (in order: TP1 → TP2 → TP3)
          let tpHit: 1 | 2 | 3 | null = null;
          const t = trade as any;
          if (trade.positionType === 'Long') {
            if (!t.tp3Executed && t.tp2Executed && currentPrice >= trade.tp3) tpHit = 3;
            else if (!t.tp2Executed && t.tp1Executed && currentPrice >= trade.tp2) tpHit = 2;
            else if (!t.tp1Executed && currentPrice >= trade.tp1) tpHit = 1;
          } else {
            if (!t.tp3Executed && t.tp2Executed && currentPrice <= trade.tp3) tpHit = 3;
            else if (!t.tp2Executed && t.tp1Executed && currentPrice <= trade.tp2) tpHit = 2;
            else if (!t.tp1Executed && currentPrice <= trade.tp1) tpHit = 1;
          }

          // Check SL hit
          const effectiveSL: number = t.effectiveSL ?? trade.stopLoss;
          const slHit =
            trade.positionType === 'Long'
              ? currentPrice <= effectiveSL
              : currentPrice >= effectiveSL;

          // Reversal detection
          let reversalDetected = trade.reversalDetected ?? false;
          let reversalConfidence = trade.reversalConfidence ?? 0;
          let reversalReason = trade.reversalReason ?? '';
          let reversalAction: AITrade['reversalAction'] = trade.reversalAction ?? 'none';

          try {
            const reversal = await detectMarketReversal(
              trade.symbol,
              trade.entryPrice,
              trade.positionType,
              trade.modality
            );
            if (reversal) {
              reversalDetected = reversal.detectedReversal;
              reversalConfidence = reversal.confidence;
              reversalReason = reversal.reason;
              // Map reversal action to valid union type
              const action = reversal.recommendedAction as string;
              if (
                action === 'close' ||
                action === 'reverse' ||
                action === 'tighten_sl' ||
                action === 'none'
              ) {
                reversalAction = action;
              } else {
                reversalAction = 'none';
              }
            }
          } catch {
            // Keep existing reversal state — non-fatal
          }

          // Build updated trade (cast to any to attach runtime-only fields)
          const updatedTrade: AITrade = {
            ...trade,
            reversalDetected,
            reversalConfidence,
            reversalReason,
            reversalAction,
          };
          // Attach price/pnl as runtime fields (not in AITrade type but read by toTradeWithPrice)
          (updatedTrade as any).currentPrice = currentPrice;
          (updatedTrade as any).pnlUsd = pnlUsd ?? 0;
          (updatedTrade as any).pnlPercent = pnlPercent ?? 0;

          updatedTrades.push(updatedTrade);

          // Record TP/SL hits
          if (slHit || tpHit !== null) {
            const outcome: 'TP Hit' | 'SL Hit' = slHit ? 'SL Hit' : 'TP Hit';
            addAITradeRecord({
              id: `${trade.id}-${slHit ? 'sl' : `tp${tpHit}`}`,
              symbol: trade.symbol,
              modality: trade.modality,
              positionType: trade.positionType,
              entryPrice: trade.entryPrice,
              exitPrice: currentPrice,
              investment: trade.investmentAmount,
              pnlUsd: pnlUsd ?? 0,
              pnlPercent: pnlPercent ?? 0,
              outcome,
              timestamp: Date.now(),
            });
            hasChanges = true;
          } else {
            // Mark as changed if price or pnl differs
            const prevPrice = (trade as any).currentPrice;
            const prevPnl = (trade as any).pnlUsd;
            if (prevPrice !== currentPrice || prevPnl !== (pnlUsd ?? 0)) {
              hasChanges = true;
            }
          }
        } catch {
          updatedTrades.push(trade);
        }
      }

      if (hasChanges) {
        saveTrades(updatedTrades);
        window.dispatchEvent(new CustomEvent('ai-trades-price-update'));
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [getTrades, saveTrades]);

  useEffect(() => {
    monitorTrades();
    intervalRef.current = setInterval(monitorTrades, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [monitorTrades]);
}
