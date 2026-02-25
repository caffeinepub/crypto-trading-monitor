# Specification

## Summary
**Goal:** Fix the AI Daily Trades tab so that P&L values display correctly using live prices, and eliminate duplicate modality cards.

**Planned changes:**
- In `AIDailyTradesSection.tsx`, ensure the live price fetch from `https://fapi.binance.com/fapi/v1/ticker/price` completes and returns a valid non-zero value before building enriched trade objects passed to `AITradeCard`; pass a loading flag when the price is not yet available.
- In `AITradeCard.tsx`, guard against zero or undefined `currentPrice` before invoking the PnL calculation; display a loading indicator (spinner or `…`) when price is unavailable, and show correctly color-coded PnL (green/red) once a valid price is loaded.
- In `useAITradeGeneration.ts` and `useAITradeStorage.ts`, audit and deduplicate the `ai_daily_trades` localStorage array so exactly four unique modality trades are stored (Scalping, Day Trading, Swing Trading, Trend Following); add a write-path guard that prevents inserting a second open trade for a modality that already has one.

**User-visible outcome:** The AI Daily Trades tab shows exactly four unique modality cards, each displaying correct live P&L values (in USD and percentage) that update on each polling cycle, with a loading indicator shown while prices are being fetched.
