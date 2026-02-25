import { StopLossRecommendation, PositionType } from '../types/position';
import { fetchKlines } from '../services/binanceApi';
import {
  detectSwingPoints,
  detectBOS,
  detectOrderBlocks,
  calcATRFromKlines,
  findSweptLiquidityZone,
} from './smcAnalysis';

export async function calculateStopLoss(
  symbol: string,
  entryPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType,
  historicalPrices: number[]
): Promise<StopLossRecommendation> {
  // Fetch klines for SMC analysis
  let klines = await fetchKlines(symbol, '1h', 100).catch(() => []);
  if (klines.length < 20) klines = [];

  const atr = klines.length > 0 ? calcATRFromKlines(klines) : entryPrice * 0.005;

  // SMC structure detection
  const swings = klines.length > 0 ? detectSwingPoints(klines, 3) : [];
  const bosSignals = klines.length > 0 ? detectBOS(klines, swings) : [];
  const obs = klines.length > 0 ? detectOrderBlocks(klines, bosSignals) : [];

  // ─── Institutional SL Placement ───────────────────────────────────────────
  // Place SL below swept liquidity zone (OB low wick or equal lows cluster) for Long
  // Place SL above swept liquidity zone for Short

  const sweptZone = findSweptLiquidityZone(klines, swings, positionType, entryPrice, atr);

  // ATR buffer: add buffer beyond the liquidity zone
  const atrMultiplier = leverage > 50 ? 0.5 : leverage > 20 ? 0.8 : leverage > 10 ? 1.0 : 1.2;
  let slPrice: number;

  if (positionType === 'Long') {
    // SL below swept liquidity zone with ATR buffer
    slPrice = sweptZone.price - atr * atrMultiplier * 0.3;

    // Also check if there's an unmitigated bullish OB below entry that provides stronger support
    const nearestBullishOB = obs.find(
      (ob) => ob.direction === 'bullish' && !ob.mitigated && ob.low < entryPrice
    );
    if (nearestBullishOB) {
      // Place SL just below the OB low wick
      const obBasedSL = nearestBullishOB.low - atr * atrMultiplier * 0.2;
      // Use the tighter of the two (closer to entry = tighter risk)
      if (obBasedSL > slPrice) slPrice = obBasedSL;
    }
  } else {
    // SL above swept liquidity zone with ATR buffer
    slPrice = sweptZone.price + atr * atrMultiplier * 0.3;

    // Check for unmitigated bearish OB above entry
    const nearestBearishOB = obs.find(
      (ob) => ob.direction === 'bearish' && !ob.mitigated && ob.high > entryPrice
    );
    if (nearestBearishOB) {
      const obBasedSL = nearestBearishOB.high + atr * atrMultiplier * 0.2;
      if (obBasedSL < slPrice) slPrice = obBasedSL;
    }
  }

  // ─── Capital Risk Enforcement (0.5% – 2% cap) ─────────────────────────────
  const MAX_CAPITAL_RISK_PCT = 2.0;
  const MIN_CAPITAL_RISK_PCT = 0.5;

  const priceChangePercent = Math.abs((slPrice - entryPrice) / entryPrice) * 100;
  const lossPercent = priceChangePercent * leverage;
  const capitalRiskPercent = lossPercent; // as % of investment

  // If capital risk exceeds 2%, tighten the SL
  if (capitalRiskPercent > MAX_CAPITAL_RISK_PCT) {
    const maxPriceChange = MAX_CAPITAL_RISK_PCT / leverage;
    if (positionType === 'Long') {
      slPrice = entryPrice * (1 - maxPriceChange / 100);
    } else {
      slPrice = entryPrice * (1 + maxPriceChange / 100);
    }
  }

  // If capital risk is below 0.5%, widen slightly to avoid noise stops
  const finalPriceChangePct = Math.abs((slPrice - entryPrice) / entryPrice) * 100;
  const finalCapitalRisk = finalPriceChangePct * leverage;
  if (finalCapitalRisk < MIN_CAPITAL_RISK_PCT) {
    const minPriceChange = MIN_CAPITAL_RISK_PCT / leverage;
    if (positionType === 'Long') {
      slPrice = entryPrice * (1 - minPriceChange / 100);
    } else {
      slPrice = entryPrice * (1 + minPriceChange / 100);
    }
  }

  // Final calculations
  const finalPriceChange = Math.abs((slPrice - entryPrice) / entryPrice) * 100;
  const finalLossPercent = finalPriceChange * leverage;
  const finalLossUSD = (investmentAmount * finalLossPercent) / 100;
  const finalCapitalRiskPct = Math.min(MAX_CAPITAL_RISK_PCT, finalLossPercent);

  const reasoning = `SL placed below ${sweptZone.type} at ${slPrice.toFixed(4)} using ${atrMultiplier.toFixed(1)}x ATR buffer (ATR=${atr.toFixed(4)}). Institutional stop placement: SL is beyond the swept liquidity zone to avoid premature stop-outs. Capital risk: ${finalCapitalRiskPct.toFixed(2)}% of position (capped at ${MAX_CAPITAL_RISK_PCT}%). Higher leverage (${leverage}x) results in tighter stop distance to maintain risk limit.`;

  const partialTakingStrategy = `SMC-based partial close strategy: Take 30-40% profit at TP1 (FVG/mitigation zone), move SL to breakeven. Take 30-40% at TP2 (swing liquidity), trail SL to TP1. Let final 20-30% run to TP3 (opposing OB/imbalance) with trailing stop at TP2. This protects capital while maximizing institutional move capture.`;

  return {
    price: slPrice,
    lossUSD: finalLossUSD,
    lossPercent: finalLossPercent,
    capitalRiskPercent: finalCapitalRiskPct,
    reasoning,
    partialTakingStrategy,
  };
}
