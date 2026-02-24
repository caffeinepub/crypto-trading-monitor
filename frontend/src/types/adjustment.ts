export type AdjustmentType = 'take-profit' | 'stop-loss';

export interface AdjustmentSuggestion {
  positionId: string;
  type: AdjustmentType;
  currentLevel: number;
  proposedLevel: number;
  reasoning: string;
  confidence: number; // 0-100
  timestamp: number;
}

export interface AdjustmentHistory {
  suggestion: AdjustmentSuggestion;
  action: 'accepted' | 'dismissed';
  timestamp: number;
}
