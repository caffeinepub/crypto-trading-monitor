export type TrendDirection = 'up' | 'down' | 'sideways';
export type TimeHorizon = 'short-term' | 'medium-term';

export interface TrendPrediction {
  direction: TrendDirection;
  confidence: number; // 0-100
  timeHorizon: TimeHorizon;
  timeLabel: string;
  timestamp: number;
}

export interface PredictionHistory {
  prediction: TrendPrediction;
  actualOutcome?: TrendDirection;
  accuracy?: number;
}
