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

/**
 * Check if price has crossed a TP level in the correct direction.
 * For Long: price >= tp level
 * For Short: price <= tp level
 */
function hasCrossedTP(currentPrice: number, tpPrice: number, positionType: 'Long' | 'Short'): boolean {
  if (positionType === 'Long') return currentPrice >= tpPrice;
  return currentPrice <= tpPrice;
}

/**
 * Check if price has crossed the effective SL level.
 * For Long: price <= sl
 * For Short: price >= sl
 */
function hasCrossedSL(currentPrice: number, slPrice: number, positionType: 'Long' | 'Short'): boolean {
  if (positionType === 'Long') return currentPrice <= slPrice;
  return currentPrice >= slPrice;
}

export function useAITradeMonitoring(trades: AITrade[] | undefined) {
  const symbols = trades ? trades.map((t) => t.symbol) : [];
  const queryClient = useQueryClient();

  // Track previous statuses to detect transitions
  const prevStatusesRef = useRef<Record<string, string>>({});
  // Track which modalities are currently being regenerated to avoid duplicate calls
  const regeneratingRef = useRef<Set<TradingModality>>(new Set());
  // Track which trades have had reversal detection run this cycle to avoid duplicates
  const reversalCheckedRef = useRef<Set<string>>(new Set());
  // Track reversal detection in-flight to avoid concurrent calls for same trade
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

      // Load current stored trades so we can persist TP execution state
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

        // Use stored state (which may have been updated in a previous cycle)
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

        // Only process TP/SL logic for Open trades
        if (status === 'Open') {
          // Check SL hit first (using effectiveSL which may have moved)
          if (hasCrossedSL(currentPrice, effectiveSL, trade.positionType)) {
            status = 'SLHit';
            riskManagementStep = 'closed';
          } else {
            // TP3 check (only after TP2 executed)
            if (!tp3Executed && tp2Executed && hasCrossedTP(currentPrice, trade.tp3, trade.positionType)) {
              tp3Executed = true;
              status = 'TPHit';
              riskManagementStep = 'closed';
            }
            // TP2 check (only after TP1 executed)
            else if (!tp2Executed && tp1Executed && hasCrossedTP(currentPrice, trade.tp2, trade.positionType)) {
              tp2Executed = true;
              // Trail SL to TP1 price
              effectiveSL = trade.tp1;
              riskManagementStep = 'trailing';
            }
            // TP1 check (first target)
            else if (!tp1Executed && hasCrossedTP(currentPrice, trade.tp1, trade.positionType)) {
              tp1Executed = true;
              // Move SL to breakeven (entry price)
              effectiveSL = trade.entryPrice;
              riskManagementStep = 'breakeven';
            }
          }
        }

        // Build the updated trade object with new execution state
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

        // Calculate PnL using effectiveSL context (PnL is still based on entry vs current)
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
          // Ensure resolved (non-optional) values for UI
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

      // Persist updated execution state to localStorage
      if (updatedTrades.length > 0) {
        saveStoredTrades(updatedTrades);
      }

      return result;
    },
    enabled: !!trades && trades.length > 0,
    refetchInterval: 5000,
  });

  // Detect status transitions to TPHit or SLHit and auto-regenerate
  // Also run reversal detection for open trades
  useEffect(() => {
    const tradesWithPrices = query.data;
    if (!tradesWithPrices || tradesWithPrices.length === 0) return;

    const totalCapital = getTotalCapital();
    const investmentPerModality =
      totalCapital !== null && totalCapital > 0
        ? totalCapital / 4
        : DEFAULT_INVESTMENT_PER_MODALITY;

    for (const trade of tradesWithPrices) {
      const prevStatus = prevStatusesRef.current[trade.id];
      const currentStatus = trade.status;

      // Detect transition: was Open (or undefined), now TPHit or SLHit
      const justClosed =
        (currentStatus === 'TPHit' || currentStatus === 'SLHit') &&
        prevStatus !== 'TPHit' &&
        prevStatus !== 'SLHit';

      if (justClosed) {
        // Save to AI trade history
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

        // Auto-regenerate a replacement trade for this modality
        (async () => {
          try {
            const newTrade = await generateAITradeForModality(trade.modality, investmentPerModality);

            // Load current stored trades and replace only this modality's entry
            const stored = loadStoredTrades();
            if (stored) {
              const updated = stored.map((t) =>
                t.modality === trade.modality ? newTrade : t
              );
              saveStoredTrades(updated);
            } else {
              saveStoredTrades([newTrade]);
            }

            // Invalidate the generation query so the UI picks up the new trade
            queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
          } catch (err) {
            console.error(`Auto-regeneration failed for ${trade.modality}:`, err);
          } finally {
            regeneratingRef.current.delete(trade.modality);
          }
        })();
      }

      // ─── Reversal Detection for Open Trades ───────────────────────────────
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

            // Load fresh stored trades to apply changes
            const stored = loadStoredTrades();
            if (!stored) return;

            const tradeIndex = stored.findIndex((t) => t.id === trade.id);
            if (tradeIndex === -1) return;

            const storedTrade = stored[tradeIndex];

            // Skip if trade is no longer open (may have been closed in the meantime)
            if (storedTrade.status !== 'Open') return;

            const updatedStoredTrades = [...stored];

            if (signal.recommendedAction === 'close') {
              // Close the trade by reversal detection
              const { pnlUSD, pnlPercent } = calculatePnL(
                storedTrade.entryPrice,
                trade.currentPrice,
                storedTrade.investmentAmount,
                storedTrade.leverage,
                storedTrade.positionType
              );

              // Save to history with reversal note
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

              // Trigger auto-regeneration for this modality
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
              // Close current trade with profit and create opposite direction trade
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
                outcomeNote: 'Closed by reversal detection — direction reversed',
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

              // Enqueue a new opposite-direction trade
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
                  console.error(`Auto-regeneration after reversal failed:`, err);
                } finally {
                  regeneratingRef.current.delete(storedTrade.modality);
                }
              }
            } else if (signal.recommendedAction === 'tighten_sl' && signal.suggestedNewSL !== undefined) {
              // Tighten the stop-loss
              updatedStoredTrades[tradeIndex] = {
                ...storedTrade,
                effectiveSL: signal.suggestedNewSL,
                profitProtectionSL: signal.suggestedNewSL,
                reversalDetected: signal.detectedReversal,
                reversalConfidence: signal.confidence,
                reversalReason: signal.reason,
                reversalAction: signal.recommendedAction,
              };
              saveStoredTrades(updatedStoredTrades);
              queryClient.invalidateQueries({ queryKey: ['ai-daily-trades'] });
            } else if (signal.detectedReversal) {
              // Update reversal fields even if no action taken
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
            console.error(`Reversal detection error for ${trade.symbol}:`, err);
          } finally {
            reversalInFlightRef.current.delete(trade.id);
          }
        })();
      }

      // Update tracked status
      prevStatusesRef.current[trade.id] = currentStatus;
    }

    // Clear the reversal checked set for next cycle
    reversalCheckedRef.current.clear();
  }, [query.data, queryClient]);

  return query;
}
