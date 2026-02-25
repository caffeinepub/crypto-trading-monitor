import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Brain, TrendingUp, BarChart2, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SentimentGauge } from '@/components/SentimentGauge';
import { TrendPredictionCard } from '@/components/TrendPredictionCard';
import { AdjustmentSuggestionCard } from '@/components/AdjustmentSuggestionCard';
import { useSentimentAnalysis } from '@/hooks/useSentimentAnalysis';
import { useTrendPrediction } from '@/hooks/useTrendPrediction';
import { useAdjustmentSuggestions } from '@/hooks/useAdjustmentSuggestions';
import { Position } from '@/types/position';
import { AdjustmentSuggestion } from '@/types/adjustment';
import { TabId } from '@/components/TabNavigation';
import {
  isLiveTradingEnabled,
  getCredentials,
} from '@/utils/liveTradingStorage';
import {
  placeTakeProfitMarketOrder,
  placeStopLossOrder,
  cancelOrder,
  getOpenOrders,
} from '@/services/binanceOrderService';
import {
  getPositionsFromStorage,
  updatePositionInStorage,
} from '@/hooks/usePositionStorage';

const ADJUSTMENT_HISTORY_KEY = 'adjustment_history';

interface AdjustmentHistoryRecord {
  id: string;
  suggestionId: string;
  symbol: string;
  type: string;
  proposedLevel: number;
  outcome: 'accepted' | 'dismissed';
  timestamp: string;
}

function saveAdjustmentHistory(record: AdjustmentHistoryRecord): void {
  try {
    const raw = localStorage.getItem(ADJUSTMENT_HISTORY_KEY);
    const history: AdjustmentHistoryRecord[] = raw ? JSON.parse(raw) : [];
    history.unshift(record);
    localStorage.setItem(
      ADJUSTMENT_HISTORY_KEY,
      JSON.stringify(history.slice(0, 200))
    );
  } catch {
    // non-fatal
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Safe accessors for AdjustmentSuggestion fields
function getSuggestionId(s: AdjustmentSuggestion): string {
  const a = s as any;
  return a.id || a.suggestionId || `${a.positionId || ''}-${s.type}-${s.timestamp}`;
}

function getSuggestionSymbol(s: AdjustmentSuggestion): string {
  const a = s as any;
  return a.symbol || a.positionSymbol || '';
}

function getSuggestionProposedLevel(s: AdjustmentSuggestion): number | undefined {
  return s.proposedLevel;
}

function isTPSuggestion(s: AdjustmentSuggestion): boolean {
  return s.type === 'take-profit';
}

function isSLSuggestion(s: AdjustmentSuggestion): boolean {
  return s.type === 'stop-loss';
}

interface AIInsightsTabProps {
  positions: Position[];
  onTabChange: (tab: TabId) => void;
}

export function AIInsightsTab({ positions, onTabChange }: AIInsightsTabProps) {
  const primarySymbol =
    positions.length > 0 ? positions[0].symbol : 'BTCUSDT';

  const { data: sentiment, isLoading: sentimentLoading } =
    useSentimentAnalysis(primarySymbol);
  const { data: prediction, isLoading: predictionLoading } =
    useTrendPrediction(primarySymbol);

  // useAdjustmentSuggestions expects PositionWithPrice[] — cast to any to avoid mismatch
  const { data: allSuggestions } = useAdjustmentSuggestions(positions as any);

  // Parent-controlled list of visible suggestions
  const [visibleSuggestions, setVisibleSuggestions] = useState<AdjustmentSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Sync visible suggestions when allSuggestions changes
  useEffect(() => {
    if (allSuggestions && allSuggestions.length > 0) {
      setVisibleSuggestions(prev => {
        const prevIds = new Set(prev.map(s => getSuggestionId(s)));
        const newOnes = allSuggestions.filter(
          s => !prevIds.has(getSuggestionId(s)) && !dismissedIds.has(getSuggestionId(s))
        );
        if (newOnes.length === 0) return prev;
        return [...prev, ...newOnes];
      });
    }
  }, [allSuggestions, dismissedIds]);

  const handleAccept = useCallback(
    async (suggestion: AdjustmentSuggestion) => {
      const sid = getSuggestionId(suggestion);
      const symbol = getSuggestionSymbol(suggestion);
      const proposedLevel = getSuggestionProposedLevel(suggestion);

      // Remove from visible list immediately
      setVisibleSuggestions(prev => prev.filter(s => getSuggestionId(s) !== sid));
      setDismissedIds(prev => new Set([...prev, sid]));

      const liveEnabled = isLiveTradingEnabled();
      const credentials = getCredentials();
      const isTP = isTPSuggestion(suggestion);
      const isSL = isSLSuggestion(suggestion);

      // Find the related position
      const allPositions = getPositionsFromStorage();
      const position = allPositions.find(p => p.symbol === symbol);

      // Get position type and quantity safely
      const posAny = position as any;
      const posType: string = posAny?.positionType || posAny?.type || 'Long';
      const isLong = posType === 'Long';
      const closeSide: 'BUY' | 'SELL' = isLong ? 'SELL' : 'BUY';
      const qty: number =
        posAny?.quantity ??
        (posAny?.totalExposure && posAny?.entryPrice
          ? posAny.totalExposure / posAny.entryPrice
          : 0);

      if (liveEnabled && credentials && proposedLevel != null) {
        if (isTP && qty > 0) {
          try {
            await withTimeout(
              placeTakeProfitMarketOrder({
                symbol,
                side: closeSide,
                quantity: qty,
                stopPrice: proposedLevel,
                credentials,
              }),
              10000
            );
            toast.success(
              `TP enviado para Binance: $${proposedLevel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Falha ao enviar TP: ${msg}`);
          }
        } else if (isSL && qty > 0) {
          // Cancel existing STOP_MARKET
          const storedOrderId = posAny?.stopLossOrderId as number | undefined;

          if (storedOrderId) {
            try {
              await withTimeout(
                cancelOrder(symbol, storedOrderId, credentials),
                10000
              );
              toast.success(`Ordem SL anterior cancelada`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`Falha ao cancelar SL anterior: ${msg}`);
            }
          } else {
            try {
              const openOrders = await withTimeout(
                getOpenOrders(symbol, credentials),
                10000
              );
              const stopOrder = openOrders.find(o => o.type === 'STOP_MARKET');
              if (stopOrder) {
                await withTimeout(
                  cancelOrder(symbol, stopOrder.orderId, credentials),
                  10000
                );
                toast.success(`Ordem SL anterior cancelada`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              toast.error(`Falha ao cancelar SL anterior: ${msg}`);
            }
          }

          // Place new SL
          try {
            await withTimeout(
              placeStopLossOrder({
                symbol,
                side: closeSide,
                quantity: qty,
                stopPrice: proposedLevel,
                credentials,
              }),
              10000
            );
            toast.success(
              `Novo SL enviado para Binance: $${proposedLevel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Falha ao enviar novo SL: ${msg}`);
          }
        }
      }

      // Update position in localStorage regardless of live trading mode
      if (position && proposedLevel != null) {
        if (isTP) {
          const updatedLevels = [...(position.takeProfitLevels ?? [])];
          if (updatedLevels.length > 0) {
            updatedLevels[0] = { ...updatedLevels[0], price: proposedLevel };
          }
          updatePositionInStorage(position.id, { takeProfitLevels: updatedLevels });
        } else if (isSL) {
          updatePositionInStorage(position.id, {
            stopLoss: { ...(position.stopLoss ?? {}), price: proposedLevel },
          });
        }
        window.dispatchEvent(new CustomEvent('positions-changed'));
      }

      // Record in adjustment history
      saveAdjustmentHistory({
        id: `${sid}-accepted-${Date.now()}`,
        suggestionId: sid,
        symbol,
        type: suggestion.type as string,
        proposedLevel: proposedLevel ?? 0,
        outcome: 'accepted',
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  const handleDismiss = useCallback((suggestion: AdjustmentSuggestion) => {
    const sid = getSuggestionId(suggestion);
    const symbol = getSuggestionSymbol(suggestion);
    const proposedLevel = getSuggestionProposedLevel(suggestion);

    setVisibleSuggestions(prev => prev.filter(s => getSuggestionId(s) !== sid));
    setDismissedIds(prev => new Set([...prev, sid]));

    saveAdjustmentHistory({
      id: `${sid}-dismissed-${Date.now()}`,
      suggestionId: sid,
      symbol,
      type: suggestion.type as string,
      proposedLevel: proposedLevel ?? 0,
      outcome: 'dismissed',
      timestamp: new Date().toISOString(),
    });
  }, []);

  const hasPositions = positions.length > 0;

  return (
    <div className="space-y-6">
      {/* Onboarding banner */}
      {!hasPositions && (
        <Alert>
          <Brain className="h-4 w-4" />
          <AlertDescription>
            Adicione posições no Dashboard para receber insights de IA
            personalizados, análise de sentimento e sugestões de ajuste.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI Insights</h2>
        {hasPositions && (
          <Badge variant="secondary" className="ml-auto">
            {primarySymbol}
          </Badge>
        )}
      </div>

      {/* Sentiment + Prediction row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Análise de Sentimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentimentLoading ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                Analisando...
              </div>
            ) : (
              <SentimentGauge symbol={primarySymbol} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Previsão de Tendência
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictionLoading ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                Calculando...
              </div>
            ) : (
              <TrendPredictionCard symbol={primarySymbol} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adjustment Suggestions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Sugestões de Ajuste</h3>
          {visibleSuggestions.length > 0 && (
            <Badge variant="secondary">{visibleSuggestions.length}</Badge>
          )}
        </div>

        {visibleSuggestions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              {hasPositions
                ? 'Nenhuma sugestão de ajuste no momento. O mercado está estável.'
                : 'Adicione posições para receber sugestões de ajuste.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleSuggestions.map(suggestion => (
              <AdjustmentSuggestionCard
                key={getSuggestionId(suggestion)}
                suggestion={suggestion}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIInsightsTab;
