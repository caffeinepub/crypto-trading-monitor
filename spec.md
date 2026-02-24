# Specification

## Summary
**Goal:** Add AI-powered market reversal detection to the Crypto Position Monitor so that open AI trades are automatically protected from losing accumulated profits when the market reverses direction.

**Planned changes:**
- Create `frontend/src/utils/marketReversalDetector.ts` with a `detectReversal` function that fetches Binance kline data and evaluates RSI divergence, EMA crossovers, candlestick reversal patterns, ATR volatility spikes, and support/resistance violations, returning a `ReversalSignal` object with confidence score and recommended action
- Extend `AITrade` type in `frontend/src/types/aiTrade.ts` with optional reversal state fields: `reversalDetected`, `reversalConfidence`, `reversalReason`, `reversalAction`, and `profitProtectionSL`
- Integrate reversal detection into `useAITradeMonitoring` hook so that on each polling cycle it runs `detectReversal` for every open trade and acts accordingly: closes the trade (confidence > 75%), reverses direction (confidence > 85% and TP1 executed), or tightens the stop-loss (confidence 50–75%)
- Update `AITradeCard` component to show an amber/orange warning banner when a reversal is detected, display a "Profit Protection SL" label when SL is tightened, and show a "Closed — Reversal Guard" status badge for trades closed by reversal detection
- Add a "Reversal Guards" count metric to `AIDailyTradesSummary` showing how many trades were protected by reversal detection today

**User-visible outcome:** Users can see when the AI detects a market reversal on any open AI trade, observe the automatic protective action taken (SL tightened, trade closed, or direction reversed), and view a daily summary of how many times the AI guarded their profits.
