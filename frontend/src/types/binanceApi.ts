export interface BinanceApiError {
  code: number;
  message: string;
  status: number;
}

export interface BinanceCredentials {
  apiKey: string;
  secret: string;
}

export interface BinanceAccountResponse {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: BinanceAsset[];
  positions: BinancePositionInfo[];
}

export interface BinanceAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  maxWithdrawAmount: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
}

export interface BinancePositionInfo {
  symbol: string;
  initialMargin: string;
  maintMargin: string;
  unrealizedProfit: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  leverage: string;
  isolated: boolean;
  entryPrice: string;
  maxNotional: string;
  positionSide: string;
  positionAmt: string;
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

/**
 * Response item from GET /fapi/v2/positionRisk
 * Represents a single position in the Binance USD-M Futures account.
 */
export interface BinancePositionRisk {
  symbol: string;
  positionAmt: string;       // positive = Long, negative = Short, "0" = no position
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;      // "BOTH" | "LONG" | "SHORT"
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface TickerPriceResponse {
  symbol: string;
  price: string;
}

export interface LeverageBracket {
  bracket: number;
  initialLeverage: number;
  notionalCap: number;
  notionalFloor: number;
  maintMarginRatio: number;
  cum: number;
}

export interface LeverageBracketResponse {
  symbol: string;
  brackets: LeverageBracket[];
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
export type OrderStatus = 'NEW' | 'FILLED' | 'CANCELED' | 'EXPIRED' | 'PARTIALLY_FILLED';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'GTX';

export interface BinanceOrder {
  orderId: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string;
  stopPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: TimeInForce;
  updateTime: number;
  clientOrderId: string;
  avgPrice: string;
  origType: string;
  reduceOnly: boolean;
  closePosition: boolean;
  positionSide: string;
  activatePrice?: string;
  priceRate?: string;
  workingType: string;
  priceProtect: boolean;
  time: number;
}

export interface BinanceOrderIds {
  entryOrderId?: number;
  stopLossOrderId?: number;
  takeProfitOrderIds?: number[];
}
