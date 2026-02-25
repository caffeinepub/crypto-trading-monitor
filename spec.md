# Specification

## Summary
**Goal:** Implement live TP/SL order execution on Binance Futures when monitored AI trade prices cross key levels, and wire Accept/Reject actions on AI recommendation suggestion cards so users can apply or dismiss TP and SL adjustments directly from the AI Insights tab.

**Planned changes:**
- Audit and fix `useAITradeMonitoring.ts` so that when a live AI trade's price crosses TP1, TP2, TP3, or the effective stop-loss, the corresponding real Binance order actions are triggered (cancel existing STOP_MARKET, place new STOP_MARKET at breakeven/trailing, or place MARKET close), only when both `isLiveTradingEnabled()` and the per-modality live order toggle are true
- Persist updated trade state (executed TP flags, `effectiveSL`, `riskManagementStep`) to localStorage under `ai_daily_trades` after each TP/SL action
- Wrap each individual Binance order call in try/catch with a 10-second Promise.race timeout; show a specific toast on failure while still updating local state
- Trigger auto-regeneration for the trade's modality after TP3 hit or SL hit; record closed trades in AI trade history with correct status
- Implement Accept action in `AIInsightsTab.tsx` for TP suggestion cards: call `placeTakeProfitMarketOrder()` when live trading is on, update the position's TP in localStorage, record the suggestion in adjustment history as 'accepted', and dismiss the card
- Implement Accept action for SL suggestion cards: cancel existing STOP_MARKET order on Binance then place a new STOP_MARKET at the suggested SL price when live trading is on, update the position's SL in localStorage, record as 'accepted', and dismiss the card
- Implement Reject action for both TP and SL suggestion cards: dismiss the card, record in adjustment history as 'dismissed', and place no orders
- Audit `AdjustmentSuggestionCard.tsx` and `AIInsightsTab.tsx` to ensure `onAccept` and `onDismiss` props are functional, non-null, and correctly wired; refactor to parent-controlled state so cards disappear immediately on accept or reject

**User-visible outcome:** Live AI trades now automatically update stop-loss orders on Binance as TP levels are hit (moving SL to breakeven then trailing), and close positions at market when TP3 or SL is crossed. In the AI Insights tab, users can click Accept on a TP or SL recommendation to immediately apply it on Binance and update their stored position, or click Reject to dismiss it — with every action recorded in adjustment history.
