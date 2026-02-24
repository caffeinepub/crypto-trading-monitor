import React from 'react';
import { AITradeWithPrice, TradingModality } from '../types/aiTrade';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Zap,
  BarChart2,
  Activity,
  Target,
} from 'lucide-react';

interface AITradeCardProps {
  trade: AITradeWithPrice;
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
  const { currentPrice, stopLoss, entryPrice, positionType } = trade;
  const totalRange = Math.abs(entryPrice - stopLoss);
  if (totalRange === 0) return false;
  const distanceToSL = Math.abs(currentPrice - stopLoss);
  return distanceToSL / totalRange < 0.1;
}

function getStatusBadge(status: string) {
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

export function AITradeCard({ trade }: AITradeCardProps) {
  const modalityConf = MODALITY_CONFIG[trade.modality];
  const isLong = trade.positionType === 'Long';
  const isProfitable = trade.pnlUsd >= 0;
  const nearSL = isNearSL(trade);

  const tp1Progress = getTpProgress(trade, trade.tp1);
  const tp2Progress = getTpProgress(trade, trade.tp2);
  const tp3Progress = getTpProgress(trade, trade.tp3);

  const formattedTime = new Date(trade.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

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
            {getStatusBadge(trade.status)}
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
          {/* PnL */}
          <div className="text-right">
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* SL Warning */}
        {nearSL && trade.status === 'Open' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Price approaching Stop Loss — monitor closely
          </div>
        )}

        {/* Price Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">Entry Price</div>
            <div className="text-sm font-semibold text-foreground">${formatPrice(trade.entryPrice)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">Current Price</div>
            <div className="text-sm font-semibold text-foreground">${formatPrice(trade.currentPrice)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">Investment</div>
            <div className="text-sm font-semibold text-foreground">${trade.investmentAmount}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground mb-0.5">Stop Loss</div>
            <div className="text-sm font-semibold text-destructive">${formatPrice(trade.stopLoss)}</div>
          </div>
        </div>

        {/* TP Levels */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Take Profit Levels</div>
          {[
            { label: 'TP1', price: trade.tp1, progress: tp1Progress },
            { label: 'TP2', price: trade.tp2, progress: tp2Progress },
            { label: 'TP3', price: trade.tp3, progress: tp3Progress },
          ].map(({ label, price, progress }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-primary font-medium">{label}</span>
                <span className="text-muted-foreground">${formatPrice(price)}</span>
                <span className="text-primary/80">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* AI Reasoning */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="text-xs font-medium text-primary mb-1.5 flex items-center gap-1">
            <span>🤖</span> AI Analysis
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{trade.reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
}
