export interface Position {
  id: string;
  symbol: string;
  side: 'Long' | 'Short';
  entryPrice: number;
  quantity: number;
  leverage: number;
}
