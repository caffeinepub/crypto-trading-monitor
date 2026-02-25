import React, { useState, useEffect, useCallback } from 'react';
import { AITradeWithPrice, RiskManagementStep, TradingModality } from '../types/aiTrade';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Zap,
  BarChart2,
  Activity,
  Target,
  CheckCircle2,
  Circle,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  RotateCcw,
  XCircle,
  Send,
  Loader2,
} from 'lucide-react';
import {
  isLiveTradingEnabled,
  getModalityLiveOrders,
  setModalityLiveOrder,
} from '../utils/liveTradingStorage';

interface AITradeCardProps {
  trade: AITradeWithPrice;
  priceLoading?: boolean;
}

const MODALITY_CONFIG: Record<
  TradingModality,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  Scalping: {
    label: 'Scalping',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/30',
    icon: <Zap className="w-3 h-3" />,
  },
  DayTrading: {
    label: 'Day Trading',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: <BarChart2 className="w-3 h-3" />,
  },
  SwingTrading: {
    label: 'Swing Trading',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    icon: <Activity className="w-3 h-3" />,
  },
  TrendFollowing: {
    label: 'Trend Following',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    icon: <Target className="w-3 h-3" />,
  },
};

const RISK_STEPS: { key: RiskManagementStep; label: string; shortLabel: string }[] = [
  { key: 'initial', label: 'Initial', shortLabel: '1' },
  { key: 'breakeven', label: 'Breakeven', shortLabel: '2' },
  { key: 'trailing', label: 'Trailing SL', shortLabel: '3' },
  { key: 'closed', label: 'Closed', shortLabel: '4' },
];

function getRiskStepIndex(step: RiskManagementStep): number {
  return RISK_STEPS.findIndex((s) => s.key === step);
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function getTpProgress(trade: AITradeWithPrice, tp: number): number {
  const { entryPrice, currentPrice, positionType } = trade;
  if (!currentPrice || currentPrice === 0) return 0;
  if (positionType === 'Long') {
    if (tp <= entryPrice) return 0;
    const progress = ((currentPrice - entryPrice) / (tp - entryPrice)) * 100;
    return Math.min(100, Math.max(0, progress));
  } else {
    if (tp >= entryPrice) return 0;
    const progress = ((entryPrice - currentPrice) / (entryPrice - tp)) * 100;
    return Math.min(100, Math.max(0, progress));
  }
}

function isNearSL(trade: AITradeWithPrice): boolean {
  if (!trade.currentPrice || trade.currentPrice === 0) return false;
  const effectiveSL = trade.effectiveSL ?? trade.stopLoss;
  const { currentPrice, entryPrice } = trade;
  const totalRange = Math.abs(entryPrice - effectiveSL);
  if (totalRange === 0) return false;
  const distanceToSL = Math.abs(currentPrice - effectiveSL);
  return distanceToSL / totalRange < 0.1;
}

function getStatusBadge(trade: AITradeWithPrice) {
  const { status, reversalAction } = trade;

  if ((status === 'SLHit' || status === 'TPHit') && (reversalAction === 'close' || reversalAction === 'reverse')) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
        🛡 Reversal Guard
      </Badge>
    );
  }

  switch (status) {
    case 'Open':
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">● Open</Badge>;
    case 'TPHit':
      return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">✓ TP Hit</Badge>;
    case 'SLHit':
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">✗ SL Hit</Badge>;
    case 'Closed':
      return <Badge variant="secondary" className="text-xs">Closed</Badge>;
    default:
      return null;
  }
}

function getSLLabel(step: RiskManagementStep): { label: string; icon: React.ReactNode; className: string } {
  switch (step) {
    case 'breakeven':
      return {
        label: 'Breakeven (Entry)',
        icon: <ShieldCheck className="w-3 h-3" />,
        className: 'text-emerald-400',
      };
    case 'trailing':
      return {
        label: 'Trailing (TP1)',
        icon: <ArrowUpRight className="w-3 h-3" />,
        className: 'text-primary',
      };
    case 'closed':
      return {
        label: 'Final SL',
        icon: <ShieldAlert className="w-3 h-3" />,
        className: 'text-muted-foreground',
      };
    default:
      return {
        label: 'Original SL',
        icon: <ShieldAlert className="w-3 h-3" />,
        className: 'text-destructive',
      };
  }
}

function getReversalActionBadge(action: string) {
  switch (action) {
    case 'tighten_sl':
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 h-4">
          SL Apertado
        </Badge>
      );
    case 'close':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 h-4">
          Trade Fechado
        </Badge>
      );
    case 'reverse':
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0 h-4">
          Direção Revertida
        </Badge>
      );
    default:
      return null;
  }
}

interface TPLevelRowProps {
  label: string;
  price: number;
  progress: number;
  executed: boolean;
}

function TPLevelRow({ label, price, progress, executed }: TPLevelRowProps) {
  return (
    <div className={`space-y-1 rounded-lg p-2 transition-all ${executed ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-muted/20'}`}>
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5">
          {executed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
          )}
          <span className={`font-semibold ${executed ? 'text-emerald-400' : 'text-primary'}`}>{label}</span>
          {executed && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
              Executado
            </Badge>
          )}
          {!executed && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
              Pendente
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${executed ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
            ${formatPrice(price)}
          </span>
          <span className={`font-bold ${executed ? 'text-emerald-400' : 'text-primary/80'}`}>
            {executed ? '100%' : `${progress.toFixed(0)}%`}
          </span>
        </div>
      </div>
      {!executed && (
        <Progress value={progress} className="h-1.5" />
      )}
      {executed && (
        <div className="h-1.5 rounded-full bg-emerald-500/40 w-full" />
      )}
    </div>
  );
}

interface RiskStepIndicatorProps {
  currentStep: RiskManagementStep;
}

function RiskStepIndicator({ currentStep }: RiskStepIndicatorProps) {
  const currentIndex = getRiskStepIndex(currentStep);

  return (
    <div className="flex items-center gap-1">
      {RISK_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <React.Fragment key={step.key}>
            <div
              className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-all ${
                isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-muted/50 text-muted-foreground'
              }`}
              title={step.label}
            >
              {isCompleted ? '✓' : step.shortLabel}
            </div>
            {index < RISK_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 min-w-[8px] rounded-full transition-all ${
                  index < currentIndex ? 'bg-emerald-500' : 'bg-muted/40'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ReversalBannerProps {
  reversalReason: string;
  reversalAction: string;
  reversalConfidence: number;
}

function ReversalBanner({ reversalReason, reversalAction, reversalConfidence }: ReversalBannerProps) {
  const getIcon = () => {
    switch (reversalAction) {
      case 'reverse':
        return <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'close':
        return <XCircle className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'tighten_sl':
        return <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {getIcon()}
          <span>Reversal Guard Ativo</span>
          <span className="text-amber-400/70 font-normal">({reversalConfidence}% confiança)</span>
        </div>
        {getReversalActionBadge(reversalAction)}
      </div>
      <p className="text-[11px] text-amber-400/80 leading-relaxed">{reversalReason}</p>
    </div>
  );
}

interface ModalityLiveToggleProps {
  modality: TradingModality;
}

function ModalityLiveToggle({ modality }: ModalityLiveToggleProps) {
  const [globalLiveEnabled, setGlobalLiveEnabled] = useState(() => isLiveTradingEnabled());
  const [modalityEnabled, setModalityEnabled] = useState(() => {
    const map = getModalityLiveOrders();
    return map[modality] ?? false;
  });

  const handleGlobalChange = useCallback(() => {
    setGlobalLiveEnabled(isLiveTradingEnabled());
  }, []);

  const handleModalityChange = useCallback(() => {
    const map = getModalityLiveOrders();
    setModalityEnabled(map[modality] ?? false);
  }, [modality]);

  useEffect(() => {
    window.addEventListener('live-trading-change', handleGlobalChange);
    window.addEventListener('modality-live-orders-change', handleModalityChange);
    return () => {
      window.removeEventListener('live-trading-change', handleGlobalChange);
      window.removeEventListener('modality-live-orders-change', handleModalityChange);
    };
  }, [handleGlobalChange, handleModalityChange]);

  const handleToggle = (checked: boolean) => {
    setModalityLiveOrder(modality, checked);
    setModalityEnabled(checked);
  };

  const isActive = globalLiveEnabled && modalityEnabled;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all ${
              isActive
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border/40 bg-muted/20'
            } ${!globalLiveEnabled ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Send
                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-muted-foreground'
                }`}
              />
              <div className="min-w-0">
                <p
                  className={`text-xs font-medium leading-tight transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-muted-foreground'
                  }`}
                >
                  Enviar ordens para Binance
                </p>
                <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
                  {!globalLiveEnabled
                    ? 'Ative o Live Trading globalmente primeiro'
                    : isActive
                    ? `${MODALITY_CONFIG[modality].label} — ordens ativas`
                    : `${MODALITY_CONFIG[modality].label} — ordens pausadas`}
                </p>
              </div>
            </div>
            <Switch
              checked={modalityEnabled}
              onCheckedChange={handleToggle}
              disabled={!globalLiveEnabled}
              className="flex-shrink-0"
            />
          </div>
        </TooltipTrigger>
        {!globalLiveEnabled && (
          <TooltipContent side="top" className="max-w-xs">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-xs">
                Ative o Live Trading globalmente nas Configurações para habilitar o envio de ordens por modalidade.
              </p>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function AITradeCard({ trade, priceLoading = false }: AITradeCardProps) {
  const modalityConf = MODALITY_CONFIG[trade.modality];
  const isLong = trade.positionType === 'Long';

  // A valid live price means: currentPrice is a finite number greater than zero
  const hasValidPrice = isFinite(trade.currentPrice) && trade.currentPrice > 0;

  // PnL is loading when: explicitly told price is loading OR we don't have a valid price yet
  const pnlIsLoading = priceLoading || !hasValidPrice;

  // Only consider PnL values meaningful when we have a valid price
  const isProfitable = hasValidPrice ? trade.pnlUsd >= 0 : true;
  const nearSL = isNearSL(trade);

  const tp1Executed = trade.tp1Executed ?? false;
  const tp2Executed = trade.tp2Executed ?? false;
  const tp3Executed = trade.tp3Executed ?? false;
  const effectiveSL = trade.effectiveSL ?? trade.stopLoss;
  const riskManagementStep: RiskManagementStep = trade.riskManagementStep ?? 'initial';

  const reversalDetected = trade.reversalDetected ?? false;
  const reversalConfidence = trade.reversalConfidence ?? 0;
  const reversalReason = trade.reversalReason ?? '';
  const reversalAction = trade.reversalAction ?? 'none';
  const profitProtectionSL = trade.profitProtectionSL;

  const tp1Progress = tp1Executed ? 100 : getTpProgress(trade, trade.tp1);
  const tp2Progress = tp2Executed ? 100 : getTpProgress(trade, trade.tp2);
  const tp3Progress = tp3Executed ? 100 : getTpProgress(trade, trade.tp3);

  const slInfo = getSLLabel(riskManagementStep);

  const formattedTime = new Date(trade.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const anyTPExecuted = tp1Executed || tp2Executed || tp3Executed;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Modality color accent bar */}
      <div
        className={`h-1 w-full ${
          trade.modality === 'Scalping'
            ? 'bg-purple-500'
            : trade.modality === 'DayTrading'
            ? 'bg-blue-500'
            : trade.modality === 'SwingTrading'
            ? 'bg-orange-500'
            : 'bg-emerald-500'
        }`}
      />

      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Modality badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${modalityConf.bgColor} ${modalityConf.color}`}
          >
            {modalityConf.icon}
            {modalityConf.label}
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(trade)}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Symbol + Direction */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">{trade.symbol.replace('USDT', '')}/USDT</span>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                isLong
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-destructive/20 text-destructive'
              }`}
            >
              {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trade.positionType}
            </div>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              {trade.leverage}x
            </Badge>
          </div>

          {/* PnL — shows spinner/dash while price is loading */}
          <div className="text-right min-w-[80px]">
            {pnlIsLoading ? (
              <div className="flex items-center justify-end gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-medium">—</span>
              </div>
            ) : (
              <>
                <div
                  className={`text-lg font-bold ${
                    isProfitable ? 'text-emerald-400' : 'text-destructive'
                  }`}
                >
                  {formatPnl(trade.pnlUsd)} USDT
                </div>
                <div
                  className={`text-xs font-medium ${
                    isProfitable ? 'text-emerald-400/80' : 'text-destructive/80'
                  }`}
                >
                  {formatPnl(trade.pnlPercent)}%
                </div>
              </>
            )}
          </div>
        </div>

        {/* Risk Step Indicator */}
        <div className="mt-2">
          <RiskStepIndicator currentStep={riskManagementStep} />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Reversal Banner */}
        {reversalDetected && reversalAction !== 'none' && (
          <ReversalBanner
            reversalReason={reversalReason}
            reversalAction={reversalAction}
            reversalConfidence={reversalConfidence}
          />
        )}

        {/* Near SL Warning */}
        {nearSL && !reversalDetected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Preço próximo ao Stop Loss!</span>
          </div>
        )}

        {/* Prices row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/20 rounded-lg p-2">
            <div className="text-muted-foreground mb-0.5">Entry Price</div>
            <div className="font-semibold text-foreground">${formatPrice(trade.entryPrice)}</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-2">
            <div className="text-muted-foreground mb-0.5">Current Price</div>
            {pnlIsLoading ? (
              <div className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">—</span>
              </div>
            ) : (
              <div className={`font-semibold ${isProfitable ? 'text-emerald-400' : 'text-destructive'}`}>
                ${formatPrice(trade.currentPrice)}
              </div>
            )}
          </div>
        </div>

        {/* Investment + Leverage info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/20 rounded-lg p-2">
            <div className="text-muted-foreground mb-0.5">Investment</div>
            <div className="font-semibold text-foreground">${trade.investmentAmount.toFixed(0)}</div>
          </div>
          <div className="bg-muted/20 rounded-lg p-2">
            <div className="text-muted-foreground mb-0.5">Notional</div>
            <div className="font-semibold text-foreground">
              ${(trade.investmentAmount * trade.leverage).toFixed(0)}
            </div>
          </div>
        </div>

        {/* TP Levels */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Take Profit Levels
          </div>
          <TPLevelRow label="TP1" price={trade.tp1} progress={tp1Progress} executed={tp1Executed} />
          <TPLevelRow label="TP2" price={trade.tp2} progress={tp2Progress} executed={tp2Executed} />
          <TPLevelRow label="TP3" price={trade.tp3} progress={tp3Progress} executed={tp3Executed} />
        </div>

        {/* Stop Loss */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            Stop Loss
          </div>
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
              nearSL
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-muted/20 border-border/30'
            }`}
          >
            <div className={`flex items-center gap-1.5 ${slInfo.className}`}>
              {slInfo.icon}
              <span className="font-medium">{slInfo.label}</span>
            </div>
            <span className={`font-bold ${nearSL ? 'text-destructive' : slInfo.className}`}>
              ${formatPrice(effectiveSL)}
            </span>
          </div>

          {/* Profit Protection SL (if set by reversal detection) */}
          {profitProtectionSL && profitProtectionSL !== effectiveSL && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400">
                <ShieldCheck className="w-3 h-3" />
                <span className="font-medium">Profit Protection SL</span>
              </div>
              <span className="font-bold text-amber-400">${formatPrice(profitProtectionSL)}</span>
            </div>
          )}
        </div>

        {/* Reasoning */}
        {trade.reasoning && (
          <div className="bg-muted/10 border border-border/30 rounded-lg p-2.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              AI Reasoning
            </div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-3">
              {trade.reasoning}
            </p>
          </div>
        )}

        {/* Live Orders Toggle */}
        <ModalityLiveToggle modality={trade.modality} />
      </CardContent>
    </Card>
  );
}

export default AITradeCard;
