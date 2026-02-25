# Specification

## Summary
**Goal:** Fix and fully implement real Binance order execution when AI trade TP/SL levels are hit, and wire up Accept/Reject actions for AI TP and SL adjustment suggestions in the AI Insights tab.

**Planned changes:**
- In `useAITradeMonitoring.ts`, fix TP/SL price-crossing logic to trigger real Binance order calls via `binanceOrderService.ts`:
  - TP1 hit: cancel existing STOP_MARKET, place new STOP_MARKET at entry (breakeven), persist `effectiveSL` and `riskManagementStep` to localStorage
  - TP2 hit: cancel current STOP_MARKET, place new STOP_MARKET at TP1 price (trailing), persist state
  - TP3 hit: place MARKET close order, record trade as closed with 'TP Hit' status, trigger auto-regeneration
  - SL hit: place MARKET close order, record trade as 'SL Hit', trigger auto-regeneration
  - All Binance calls only fire when `isLiveTradingEnabled()` AND per-modality live orders are both true
  - Each call wrapped in try/catch with 10-second timeout; failures show toast and do not block local state update
- In `AIInsightsTab.tsx`, implement functional `onAccept` and `onDismiss` handlers passed to each `AdjustmentSuggestionCard`:
  - Accept TP suggestion: place `TAKE_PROFIT_MARKET` order on Binance (if live trading on), update position TP in localStorage, record 'accepted' in adjustment history
  - Reject TP suggestion: dismiss card, record 'dismissed' in adjustment history
  - Accept SL suggestion: cancel existing STOP_MARKET and place new one at suggested price (if live trading on), update position SL in localStorage, record 'accepted' in adjustment history
  - Reject SL suggestion: dismiss card, record 'dismissed' in adjustment history
- Refactor `AdjustmentSuggestionCard.tsx` so parent controls accept/dismiss state; cards are removed from UI immediately after either action with no stale cards remaining

**User-visible outcome:** When AI trade prices cross TP1/TP2/TP3 or the stop-loss, real Binance orders are automatically placed or cancelled as appropriate. In the AI Insights tab, clicking Accept or Reject on TP/SL suggestion cards correctly executes or dismisses the recommendation, places real orders when live trading is active, and instantly removes the card from view.
