import { TakeProfitLevel, PositionType } from '../types/position';
import { calculateVolatility } from './technicalAnalysis';
import { fetchKlines } from '../services/binanceApi';
import {
  detectSwingPoints,
  detectBOS,
  detectOrderBlocks,
  detectFVGs,
  calcATRFromKlines,
  findNearestOpenFVG,
  findNearestUnmitigatedOB,
} from './smcAnalysis';

export async function calculateTakeProfitLevels(
  symbol: string,
  entryPrice: number,
  investmentAmount: number,
  leverage: number,
  positionType: PositionType,
  historicalPrices: number[]
): Promise<TakeProfitLevel[]> {
  const volatility = calculateVolatility(historicalPrices);

  // Fetch klines for SMC analysis
  let klines = await fetchKlines(symbol, '1h', 100).catch(() => []);
  if (klines.length < 20) {
    // Fallback to basic calculation if klines unavailable
    klines = [];
  }

  const atr = klines.length > 0 ? calcATRFromKlines(klines) : entryPrice * 0.005;
  const maxTPDistance = atr * 3; // TP levels > 3x ATR get replaced

  // SMC structure detection
  const swings = klines.length > 0 ? detectSwingPoints(klines, 3) : [];
  const bosSignals = klines.length > 0 ? detectBOS(klines, swings) : [];
  const obs = klines.length > 0 ? detectOrderBlocks(klines, bosSignals) : [];
  const fvgs = klines.length > 0 ? detectFVGs(klines) : [];

  const fvgDir = positionType === 'Long' ? 'bullish' : 'bearish';
  const obDir = positionType === 'Long' ? 'bearish' : 'bullish'; // opposing OB for TP3

  // Swing points for TP2 (external liquidity)
  const swingHighs = swings.filter((s) => s.type === 'high').map((s) => s.price).sort((a, b) => a - b);
  const swingLows = swings.filter((s) => s.type === 'low').map((s) => s.price).sort((a, b) => b - a);

  // Volatility-based fallback multipliers
  const volatilityFactor = Math.max(volatility / 2, 1);
  let tp1Multiplier = 0.015 * volatilityFactor;
  let tp2Multiplier = 0.035 * volatilityFactor;
  let tp3Multiplier = 0.06 * volatilityFactor;

  if (leverage > 20) {
    tp1Multiplier *= 0.7;
    tp2Multiplier *= 0.7;
    tp3Multiplier *= 0.7;
  }

  const takeProfitLevels: TakeProfitLevel[] = [];

  // ─── TP1: Nearest open FVG or mitigation zone ─────────────────────────────
  let tp1Price: number;
  let tp1Reasoning: string;

  const nearestFVG = findNearestOpenFVG(fvgs, entryPrice, fvgDir);

  if (nearestFVG && Math.abs(nearestFVG.midpoint - entryPrice) <= maxTPDistance) {
    tp1Price = nearestFVG.midpoint;
    tp1Reasoning = `TP1 at FVG fill ${tp1Price.toFixed(4)} — open ${fvgDir} Fair Value Gap acts as first price magnet. Institutional imbalance zone. Take 30-40% profit here.`;
  } else {
    // Fallback: nearest unmitigated OB in trade direction as mitigation zone
    const nearestOBMitigation = findNearestUnmitigatedOB(obs, entryPrice, fvgDir);
    if (nearestOBMitigation && Math.abs(nearestOBMitigation.price - entryPrice) <= maxTPDistance) {
      tp1Price = nearestOBMitigation.price;
      tp1Reasoning = `TP1 at OB mitigation zone ${tp1Price.toFixed(4)} — unmitigated ${fvgDir} Order Block. Institutional orders pending at this level. Take 30-40% profit here.`;
    } else {
      tp1Price = positionType === 'Long'
        ? entryPrice * (1 + tp1Multiplier)
        : entryPrice * (1 - tp1Multiplier);
      tp1Reasoning = `TP1 at ${tp1Price.toFixed(4)} — ATR-based conservative target (no FVG/OB within range). Take 30-40% profit here.`;
    }
  }

  // Enforce direction
  if (positionType === 'Long' && tp1Price <= entryPrice) tp1Price = entryPrice * (1 + tp1Multiplier);
  if (positionType === 'Short' && tp1Price >= entryPrice) tp1Price = entryPrice * (1 - tp1Multiplier);

  const tp1ProfitPercent = positionType === 'Long'
    ? ((tp1Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp1Price) / entryPrice) * 100 * leverage;

  takeProfitLevels.push({
    level: 1,
    price: tp1Price,
    profitUSD: (investmentAmount * tp1ProfitPercent) / 100,
    profitPercent: tp1ProfitPercent,
    reasoning: tp1Reasoning,
  });

  // ─── TP2: Nearest swing high/low (external liquidity) ─────────────────────
  let tp2Price: number;
  let tp2Reasoning: string;

  if (positionType === 'Long') {
    const nextSwingHigh = swingHighs.find((h) => h > tp1Price * 1.001);
    if (nextSwingHigh && Math.abs(nextSwingHigh - entryPrice) <= maxTPDistance * 2) {
      tp2Price = nextSwingHigh;
      tp2Reasoning = `TP2 at swing high liquidity ${tp2Price.toFixed(4)} — external liquidity pool where sell stops are clustered. Institutional target zone. Take 30-40% profit here.`;
    } else {
      tp2Price = entryPrice * (1 + tp2Multiplier);
      tp2Reasoning = `TP2 at ${tp2Price.toFixed(4)} — ATR-based moderate target (swing high beyond ATR range). Take 30-40% profit here.`;
    }
  } else {
    const nextSwingLow = swingLows.find((l) => l < tp1Price * 0.999);
    if (nextSwingLow && Math.abs(entryPrice - nextSwingLow) <= maxTPDistance * 2) {
      tp2Price = nextSwingLow;
      tp2Reasoning = `TP2 at swing low liquidity ${tp2Price.toFixed(4)} — external liquidity pool where buy stops are clustered. Institutional target zone. Take 30-40% profit here.`;
    } else {
      tp2Price = entryPrice * (1 - tp2Multiplier);
      tp2Reasoning = `TP2 at ${tp2Price.toFixed(4)} — ATR-based moderate target (swing low beyond ATR range). Take 30-40% profit here.`;
    }
  }

  // Enforce TP2 > TP1 (Long) or TP2 < TP1 (Short)
  if (positionType === 'Long' && tp2Price <= tp1Price) tp2Price = tp1Price * (1 + tp2Multiplier * 0.5);
  if (positionType === 'Short' && tp2Price >= tp1Price) tp2Price = tp1Price * (1 - tp2Multiplier * 0.5);

  const tp2ProfitPercent = positionType === 'Long'
    ? ((tp2Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp2Price) / entryPrice) * 100 * leverage;

  takeProfitLevels.push({
    level: 2,
    price: tp2Price,
    profitUSD: (investmentAmount * tp2ProfitPercent) / 100,
    profitPercent: tp2ProfitPercent,
    reasoning: tp2Reasoning,
  });

  // ─── TP3: Opposing OB or major imbalance zone ──────────────────────────────
  let tp3Price: number;
  let tp3Reasoning: string;

  const opposingOB = findNearestUnmitigatedOB(obs, entryPrice, obDir);

  if (positionType === 'Long') {
    if (opposingOB && opposingOB.price > tp2Price && Math.abs(opposingOB.price - entryPrice) <= maxTPDistance * 4) {
      tp3Price = opposingOB.price;
      tp3Reasoning = `TP3 at opposing bearish OB ${tp3Price.toFixed(4)} — unmitigated institutional supply zone. Price likely to react here. Let 20-30% run with trailing stop at TP2.`;
    } else {
      // Check for open bearish FVG above TP2
      const bearishFVG = findNearestOpenFVG(fvgs, tp2Price, 'bearish');
      if (bearishFVG && bearishFVG.midpoint > tp2Price) {
        tp3Price = bearishFVG.midpoint;
        tp3Reasoning = `TP3 at bearish FVG ${tp3Price.toFixed(4)} — open imbalance zone above TP2 acting as extended target. Let 20-30% run with trailing stop at TP2.`;
      } else {
        tp3Price = entryPrice * (1 + tp3Multiplier);
        tp3Reasoning = `TP3 at ${tp3Price.toFixed(4)} — extended SMC target (no opposing OB/FVG within range). Let 20-30% run with trailing stop at TP2.`;
      }
    }
  } else {
    if (opposingOB && opposingOB.price < tp2Price && Math.abs(entryPrice - opposingOB.price) <= maxTPDistance * 4) {
      tp3Price = opposingOB.price;
      tp3Reasoning = `TP3 at opposing bullish OB ${tp3Price.toFixed(4)} — unmitigated institutional demand zone. Price likely to react here. Let 20-30% run with trailing stop at TP2.`;
    } else {
      const bullishFVG = findNearestOpenFVG(fvgs, tp2Price, 'bullish');
      if (bullishFVG && bullishFVG.midpoint < tp2Price) {
        tp3Price = bullishFVG.midpoint;
        tp3Reasoning = `TP3 at bullish FVG ${tp3Price.toFixed(4)} — open imbalance zone below TP2 acting as extended target. Let 20-30% run with trailing stop at TP2.`;
      } else {
        tp3Price = entryPrice * (1 - tp3Multiplier);
        tp3Reasoning = `TP3 at ${tp3Price.toFixed(4)} — extended SMC target (no opposing OB/FVG within range). Let 20-30% run with trailing stop at TP2.`;
      }
    }
  }

  // Enforce TP3 > TP2 (Long) or TP3 < TP2 (Short)
  if (positionType === 'Long' && tp3Price <= tp2Price) tp3Price = tp2Price * (1 + tp3Multiplier * 0.5);
  if (positionType === 'Short' && tp3Price >= tp2Price) tp3Price = tp2Price * (1 - tp3Multiplier * 0.5);

  const tp3ProfitPercent = positionType === 'Long'
    ? ((tp3Price - entryPrice) / entryPrice) * 100 * leverage
    : ((entryPrice - tp3Price) / entryPrice) * 100 * leverage;

  takeProfitLevels.push({
    level: 3,
    price: tp3Price,
    profitUSD: (investmentAmount * tp3ProfitPercent) / 100,
    profitPercent: tp3ProfitPercent,
    reasoning: tp3Reasoning,
  });

  return takeProfitLevels;
}
