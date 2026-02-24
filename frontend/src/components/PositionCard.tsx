import { useState } from 'react';
import { PositionWithPrice } from '../types/position';
import { UserTradeRecord } from '../types/tradeHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingUp, TrendingDown, Trash2, Target, Shield, ChevronDown, Sparkles } from 'lucide-react';
import { TakeProfitRecommendations } from './TakeProfitRecommendations';
import { StopLossRecommendations } from './StopLossRecommendations';
import { SentimentGauge } from './SentimentGauge';
import { TrendPredictionCard } from './TrendPredictionCard';
import { AdjustmentSuggestionCard } from './AdjustmentSuggestionCard';
import { TradeOutcomeModal } from './TradeOutcomeModal';
import { useAdjustmentSuggestions } from '../hooks/useAdjustmentSuggestions';
import { saveUserTrade } from '../utils/tradeHistoryStorage';

interface PositionCardProps {
  position: PositionWithPrice;
  onDelete: () => void;
  onUpdate: (id: string, updates: Partial<PositionWithPrice>) => void;
}

export function PositionCard({ position, onDelete, onUpdate }: PositionCardProps) {
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const { data: allSuggestions } = useAdjustmentSuggestions([position]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const isProfit = position.pnlUSD >= 0;
  const isNearTP = Math.abs(position.distanceToTP1) < 2;
  const isNearSL = Math.abs(position.distanceToSL) < 2;

  const activeSuggestions = (allSuggestions || []).filter(
    (s) => !dismissedSuggestions.has(`${s.positionId}-${s.type}-${s.timestamp}`)
  );

  const handleAcceptSuggestion = async (suggestion: any) => {
    if (suggestion.type === 'stop-loss') {
      onUpdate(position.id, {
        stopLoss: {
          ...position.stopLoss,
          price: suggestion.proposedLevel,
        },
      });
    } else if (suggestion.type === 'take-profit') {
      const updatedLevels = [...position.takeProfitLevels];
      if (updatedLevels[0]) {
        updatedLevels[0] = {
          ...updatedLevels[0],
          price: suggestion.proposedLevel,
        };
      }
      onUpdate(position.id, {
        takeProfitLevels: updatedLevels,
      });
    }
    setDismissedSuggestions(prev => new Set(prev).add(`${suggestion.positionId}-${suggestion.type}-${suggestion.timestamp}`));
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set(prev).add(suggestionId));
  };

  const handleDeleteClick = () => {
    setOutcomeModalOpen(true);
  };

  const handleOutcomeSave = (record: UserTradeRecord) => {
    saveUserTrade(record);
    onDelete();
  };

  const handleOutcomeClose = () => {
    setOutcomeModalOpen(false);
    // Still delete the position even if user cancels the outcome modal
    onDelete();
  };

  const handleOutcomeCancel = () => {
    setOutcomeModalOpen(false);
    // Delete without saving history
    onDelete();
  };

  return (
    <>
      <Card className={`shadow-xl border-2 transition-all relative overflow-hidden ${
        isNearTP ? 'border-chart-1 shadow-chart-1/30 golden-glow' : 
        isNearSL ? 'border-destructive shadow-destructive/30' : 
        'border-primary/30 shadow-primary/10'
      }`}>
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
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {position.symbol}
                  </CardTitle>
                  <Badge 
                    variant={position.positionType === 'Long' ? 'default' : 'destructive'} 
                    className={`font-semibold ${position.positionType === 'Long' ? 'bg-primary hover:bg-primary/90' : ''}`}
                  >
                    {position.positionType === 'Long' ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {position.positionType}
                  </Badge>
                  <Badge variant="outline" className="border-primary/50 text-primary">{position.leverage}x</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Entry: <span className="text-primary font-medium">${position.entryPrice.toFixed(4)}</span></span>
                  <span>•</span>
                  <span>Current: <span className="text-accent font-medium">${position.currentPrice.toFixed(4)}</span></span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* PnL Section */}
            <div className={`p-4 rounded-lg border ${
              isProfit 
                ? 'bg-chart-1/10 border-chart-1/30' 
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Profit & Loss</span>
                <Badge 
                  variant={isProfit ? 'default' : 'destructive'} 
                  className={`text-base font-bold ${isProfit ? 'bg-chart-1 hover:bg-chart-1/90' : ''}`}
                >
                  {isProfit ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-2xl font-bold ${isProfit ? 'text-chart-1' : 'text-destructive'}`}>
                  {isProfit ? '+' : ''}{position.pnlUSD >= 0 ? '$' : '-$'}{Math.abs(position.pnlUSD).toFixed(2)}
                </span>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Investment: <span className="text-foreground font-medium">${position.investmentAmount.toFixed(2)}</span></div>
                  <div>Exposure: <span className="text-primary font-medium">${position.totalExposure.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            {/* AI Insights Section */}
            <Collapsible open={aiInsightsOpen} onOpenChange={setAiInsightsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between border-primary/30">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI Insights & Analysis
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${aiInsightsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Adjustment Suggestions */}
                {activeSuggestions.length > 0 && (
                  <div className="space-y-2">
                    {activeSuggestions.map((suggestion) => (
                      <AdjustmentSuggestionCard
                        key={`${suggestion.positionId}-${suggestion.type}-${suggestion.timestamp}`}
                        suggestion={suggestion}
                        onAccept={handleAcceptSuggestion}
                        onDismiss={handleDismissSuggestion}
                      />
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <SentimentGauge symbol={position.symbol} />
                  <TrendPredictionCard symbol={position.symbol} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator className="bg-primary/20" />

            {/* Take Profit Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-chart-1" />
                <h3 className="font-semibold">Take Profit Levels</h3>
                {isNearTP && (
                  <Badge variant="default" className="bg-chart-1 hover:bg-chart-1/90">
                    Near TP1!
                  </Badge>
                )}
              </div>
              <TakeProfitRecommendations
                levels={position.takeProfitLevels}
                currentPrice={position.currentPrice}
                positionType={position.positionType}
              />
            </div>

            <Separator className="bg-primary/20" />

            {/* Stop Loss Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-destructive" />
                <h3 className="font-semibold">Stop Loss</h3>
                {isNearSL && (
                  <Badge variant="destructive">
                    Near SL!
                  </Badge>
                )}
              </div>
              <StopLossRecommendations
                stopLoss={position.stopLoss}
                currentPrice={position.currentPrice}
                positionType={position.positionType}
              />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Trade Outcome Modal */}
      {outcomeModalOpen && (
        <TradeOutcomeModal
          isOpen={outcomeModalOpen}
          onClose={handleOutcomeCancel}
          position={position}
          onSave={handleOutcomeSave}
        />
      )}
    </>
  );
}
