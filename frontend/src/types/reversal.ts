/**
 * TypeScript type definitions for market reversal detection.
 */

export interface ReversalSignal {
  detectedReversal: boolean;
  confidence: number; // 0-100
  reason: string;
  recommendedAction: 'close' | 'reverse' | 'tighten_sl' | 'none';
  suggestedNewSL?: number;
}

export interface RSIDivergence {
  detected: boolean;
  strength: number; // 0-100
  description: string;
}

export interface EMACrossover {
  detected: boolean;
  strength: number; // 0-100
  description: string;
}

export interface CandlestickPattern {
  detected: boolean;
  patternName: string;
  strength: number; // 0-100
}

export interface VolatilitySpike {
  detected: boolean;
  multiplier: number; // how many times above average ATR
  strength: number; // 0-100
}

export interface SupportResistanceViolation {
  detected: boolean;
  level: number;
  strength: number; // 0-100
}
