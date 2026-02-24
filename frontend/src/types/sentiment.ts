export type SentimentScore = 'bullish' | 'bearish' | 'neutral';

export interface SentimentFactor {
  indicator: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface SentimentAnalysis {
  score: SentimentScore;
  strength: number; // 0-100
  factors: SentimentFactor[];
  timestamp: number;
}
