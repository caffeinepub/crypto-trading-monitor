import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
import { AITrade, AITradeWithPrice, RiskManagementStep, TradingModality } from '../types/aiTrade';
import { fetchCurrentPrices } from '../services/binanceApi';
import { calculatePnL } from '../utils/pnlCalculations';
import { generateAITradeForModality } from '../utils/aiTradeSelection';
import { getTotalCapital } from '../utils/totalCapitalStorage';
import { saveAITradeHistory } from '../utils/aiTradeHistoryStorage';
import { detectReversal } from '../utils/marketReversalDetector';

const STORAGE_KEY = 'ai_daily_trades';
const DEFAULT_INVESTMENT_PER_MODALITY = 1000;

function getCurrentUTCDate(): string {
  return new Date().toISOString().split('T')[0];
}

function loadStoredTrades(): AITrade[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.utcDate !== getCurrentUTCDate()) return null;
    return data.trades as AITrade[];
  } catch {
    return null;
  }
}

function saveStoredTrades(trades: AITrade[]): void {
  const data = { utcDate: getCurrentUTCDate(), trades };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Resolve optional execution-state fields to concrete values */
function resolveTradeDefaults(trade: AITrade): Required<
  Pick<
    AITrade,
    | 'tp1Executed'
    | 'tp2Executed'
    | 'tp3Executed'
    | 'effectiveSL'
    | 'riskManagementStep'
    | 'reversalDetected'
    | 'reversalConfidence'
    | 'reversalReason'
    | 'reversalAction'
  >
> {
  return {
    tp1Executed: trade.tp1Executed ?? false,
    tp2Executed: trade.tp2Executed ?? false,
    tp3Executed: trade.tp3Executed ?? false,
    effectiveSL: trade.effectiveSL ?? trade.stopLoss,
    riskManagementStep: (trade.riskManagementStep ?? 'initial') as RiskManagementStep,
    reversalDetected: trade.reversalDetected ?? false,
    reversalConfidence: trade.reversalConfidence ?? 0,
    reversalReason: trade.reversalReason ?? '',
    reversalAction: trade.reversalAction ?? 'none',
  };
}

function hasCrossedTP(currentPrice: number, tpPrice: number, positionType: 'Long' | 'Short'): boolean {
  if (positionType === 'Long') return currentPrice >= tpPrice;
  return currentPrice <= tpPrice;
}

function hasCrossedSL(currentPrice: number, slPrice: number, positionType: 'Long' | 'Short'): boolean {
  if (positionType === 'Long') return currentPrice <= slPrice;
  return currentPrice >= slPrice;
}

export function useAITradeMonitoring(trades: AITrade[] | undefined) {
  const symbols = trades ? trades.map((t) => t.symbol) : [];
  const queryClient = useQueryClient();

  const prevStatusesRef = useRef<Record<string, string>>({});
  const regeneratingRef = useRef<Set<TradingModality>>(new Set());
  const reversalInFlightRef = useRef<Set<string>>(new Set());

  const query = useQuery<AITradeWithPrice[]>({
    queryKey: ['ai-trade-prices', symbols.join(',')],
    queryFn: async () => {
      if (!trades || trades.length === 0) return [];

      const prices = await fetchCurrentPrices(symbols);
      const priceMap: Record<string, number> = {};
      for (const p of prices) {
        priceMap[p.symbol] = parseFloat(p.price);
      }

      const storedTrades = loadStoredTrades();
      const storedMap: Record<string, AITrade> = {};
      if (storedTrades) {
        for (const t of storedTrades) {
          storedMap[t.id] = t;
        }
      }

      const updatedTrades: AITrade[] = [];
      const result: AITradeWithPrice[] = [];

      for (const trade of trades) {
        const currentPrice = priceMap[trade.symbol] ?? trade.entryPrice;

        const stored = storedMap[trade.id] ?? trade;
        const defaults = resolveTradeDefaults(stored);

        let {
          tp1Executed,
          tp2Executed,
          tp3Executed,
          effectiveSL,
          riskManagementStep,
          reversalDetected,
          reversalConfidence,
          reversalReason,
          reversalAction,
        } = defaults;

        let profitProtectionSL = stored.profitProtectionSL;
        let status = stored.status ?? trade.status;

        if (status === 'Open') {
          if (hasCrossedSL(currentPrice, effectiveSL, trade.positionType)) {
            status = 'SLHit';
            riskManagementStep = 'closed';
          } else {
            if (!tp3Executed && tp2Executed && hasCrossedTP(currentPrice, trade.tp3, trade.positionType)) {
              tp3Executed = true;
              status = 'TPHit';
              riskManagementStep = 'closed';
            } else if (!tp2Executed && tp1Executed && hasCrossedTP(currentPrice, trade.tp2, trade.positionType)) {
              tp2Executed = true;
              effectiveSL = trade.tp1;
              riskManagementStep = 'trailing';
            } else if (!tp1Executed && hasCrossedTP(currentPrice, trade.tp1, trade.positionType)) {
              tp1Executed = true;
              effectiveSL = trade.entryPrice;
              riskManagementStep = 'breakeven';
            }
          }
        }

        const updatedTrade: AITrade = {
          ...stored,
          status,
          tp1Executed,
          tp2Executed,
          tp3Executed,
          effectiveSL,
          riskManagementStep,
          reversalDetected,
          reversalConfidence,
          reversalReason,
          reversalAction,
          profitProtectionSL,
        };

        updatedTrades.push(updatedTrade);

        const { pnlUSD, pnlPercent } = calculatePnL(
          trade.entryPrice,
          currentPrice,
          trade.investmentAmount,
          trade.leverage,
          trade.positionType
        );

        result.push({
          ...updatedTrade,
          currentPrice,
          pnlUsd: pnlUSD,
          pnlPercent,
          tp1Executed,
          tp2Executed,
          tp3Executed,
          effectiveSL,
          riskManagementStep,
          reversalDetected,
          reversalConfidence,
          reversalReason,
          reversalAction,
        });
      }

      if (updatedTrades.length > 0) {
        saveStoredTrades(updatedTrades);
      }

      return result;
    },
    enabled: !!trades && trades.length > 0,
    refetchInterval: 5000,
  });

  // Detect status transitions and auto-regenerate; run reversal detection for open trades
  useEffect(() => {
    const tradesWithPrices = query.data;
    if (!tradesWithPrices || tradesWithPrices.length === 0) return;

    const rawCapital = getTotalCapital();
    const totalCapital = rawCapital !== null ? rawCapital : 0;
    const investmentPerModality =
      totalCapital > 0 ? totalCapital / 4 : DEFAULT_INVESTMENT_PER_MODALITY;

    for (const trade of tradesWithPrices) {
      const prevStatus = prevStatusesRef.current[trade.id];
      const currentStatus = trade.status;

      const justClosed =
        (currentStatus === 'TPHit' || currentStatus === 'SLHit') &&
        prevStatus !== 'TPHit' &&
        prevStatus !== 'SLHit';

      if (justClosed) {
        saveAITradeHistory({
          id: trade.id,
          symbol: trade.symbol,
          modality: trade.modality,
          positionType: trade.positionType,
          entryPrice: trade.entryPrice,
          exitPrice: trade.currentPrice,
          investment: trade.investmentAmount,
          pnlUsd: trade.pnlUsd,
          pnlPercent: trade.pnlPercent,
          outcome: currentStatus === 'TPHit' ? 'TP Hit' : 'SL Hit',
          timestamp: Date.now(),
        });
      }

      if (justClosed && !regeneratingRef.current.has(trade.modality)) {
        regeneratingRef.current.add(trade.modality);

        (async () => {
          try {
            const newTrade = await generateAITradeForModality(trade.modality, investmentPerModality);

            const stored = loadStoredTrades();
            if (stored) {
              const updated = stored.map((t) =>
                t.modality === trade.modality ? newTrade : t
              );
              saveStoredTrades(updated);
            } else {
              saveStoredTrades([newTrade]);
            }

            queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
          } catch (err) {
            console.error(`Auto-regeneration failed for ${trade.modality}:`, err);
          } finally {
            regeneratingRef.current.delete(trade.modality);
          }
        })();
      }

      // Update previous status tracking
      prevStatusesRef.current[trade.id] = currentStatus;

      // Reversal detection for open trades
      if (
        currentStatus === 'Open' &&
        !reversalInFlightRef.current.has(trade.id)
      ) {
        reversalInFlightRef.current.add(trade.id);

        (async () => {
          try {
            const signal = await detectReversal({
              symbol: trade.symbol,
              positionType: trade.positionType,
              entryPrice: trade.entryPrice,
              effectiveSL: trade.effectiveSL,
              currentPrice: trade.currentPrice,
              modality: trade.modality,
              tp1Executed: trade.tp1Executed,
              tp2Executed: trade.tp2Executed,
              tp3Executed: trade.tp3Executed,
              tp1: trade.tp1,
            });

            const stored = loadStoredTrades();
            if (!stored) return;

            const tradeIndex = stored.findIndex((t) => t.id === trade.id);
            if (tradeIndex === -1) return;

            const storedTrade = stored[tradeIndex];
            if (storedTrade.status !== 'Open') return;

            const updatedStoredTrades = [...stored];

            if (signal.recommendedAction === 'close') {
              const { pnlUSD, pnlPercent } = calculatePnL(
                storedTrade.entryPrice,
                trade.currentPrice,
                storedTrade.investmentAmount,
                storedTrade.leverage,
                storedTrade.positionType
              );

              saveAITradeHistory({
                id: storedTrade.id,
                symbol: storedTrade.symbol,
                modality: storedTrade.modality,
                positionType: storedTrade.positionType,
                entryPrice: storedTrade.entryPrice,
                exitPrice: trade.currentPrice,
                investment: storedTrade.investmentAmount,
                pnlUsd: pnlUSD,
                pnlPercent,
                outcome: 'SL Hit',
                timestamp: Date.now(),
                outcomeNote: 'Closed by reversal detection',
              });

              updatedStoredTrades[tradeIndex] = {
                ...storedTrade,
                status: 'SLHit',
                riskManagementStep: 'closed',
                reversalDetected: signal.detectedReversal,
                reversalConfidence: signal.confidence,
                reversalReason: signal.reason,
                reversalAction: signal.recommendedAction,
              };

              saveStoredTrades(updatedStoredTrades);

              if (!regeneratingRef.current.has(storedTrade.modality)) {
                regeneratingRef.current.add(storedTrade.modality);
                try {
                  const newTrade = await generateAITradeForModality(
                    storedTrade.modality,
                    investmentPerModality
                  );
                  const freshStored = loadStoredTrades();
                  if (freshStored) {
                    const updated = freshStored.map((t) =>
                      t.modality === storedTrade.modality ? newTrade : t
                    );
                    saveStoredTrades(updated);
                  }
                  queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
                } catch (err) {
                  console.error(`Auto-regeneration after reversal close failed:`, err);
                } finally {
                  regeneratingRef.current.delete(storedTrade.modality);
                }
              }
            } else if (signal.recommendedAction === 'reverse' && storedTrade.tp1Executed) {
              // Mark as closed by reversal, will be regenerated
              const { pnlUSD, pnlPercent } = calculatePnL(
                storedTrade.entryPrice,
                trade.currentPrice,
                storedTrade.investmentAmount,
                storedTrade.leverage,
                storedTrade.positionType
              );

              saveAITradeHistory({
                id: storedTrade.id,
                symbol: storedTrade.symbol,
                modality: storedTrade.modality,
                positionType: storedTrade.positionType,
                entryPrice: storedTrade.entryPrice,
                exitPrice: trade.currentPrice,
                investment: storedTrade.investmentAmount,
                pnlUsd: pnlUSD,
                pnlPercent,
                outcome: 'TP Hit',
                timestamp: Date.now(),
                outcomeNote: 'Closed by reversal detection (reverse signal after TP1)',
              });

              updatedStoredTrades[tradeIndex] = {
                ...storedTrade,
                status: 'TPHit',
                riskManagementStep: 'closed',
                reversalDetected: signal.detectedReversal,
                reversalConfidence: signal.confidence,
                reversalReason: signal.reason,
                reversalAction: signal.recommendedAction,
              };

              saveStoredTrades(updatedStoredTrades);
              queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
            } else if (signal.recommendedAction === 'tighten_sl' && signal.suggestedNewSL) {
              updatedStoredTrades[tradeIndex] = {
                ...storedTrade,
                reversalDetected: signal.detectedReversal,
                reversalConfidence: signal.confidence,
                reversalReason: signal.reason,
                reversalAction: signal.recommendedAction,
                profitProtectionSL: signal.suggestedNewSL,
                effectiveSL: signal.suggestedNewSL,
              };
              saveStoredTrades(updatedStoredTrades);
            } else {
              // Update reversal state even if no action
              updatedStoredTrades[tradeIndex] = {
                ...storedTrade,
                reversalDetected: signal.detectedReversal,
                reversalConfidence: signal.confidence,
                reversalReason: signal.reason,
                reversalAction: signal.recommendedAction,
              };
              saveStoredTrades(updatedStoredTrades);
            }
          } catch (err) {
            console.error(`Reversal detection failed for ${trade.symbol}:`, err);
          } finally {
            reversalInFlightRef.current.delete(trade.id);
          }
        })();
      }
    }
  }, [query.data, queryClient]);

  return query;
}
