# Specification

## Summary
**Goal:** Fix the Live Trading mode toggle so it no longer freezes the application, and ensure real orders are correctly sent to Binance Futures when Live Trading mode is active.

**Planned changes:**
- Fix `LiveTradingToggle.tsx` and `useLiveTradingMode.ts` to prevent UI freeze when enabling Live Trading mode by ensuring all async operations (credential validation, localStorage write, confirmation dialog) are non-blocking with proper error boundaries.
- Audit and fix `useEffect` and React Query dependency arrays in `useLiveTradingMode.ts`, `usePositionStorage.ts`, and `useAITradeGeneration.ts` to eliminate infinite re-render loops triggered by live trading state changes.
- Ensure custom `window` event listeners for live trading state changes are registered once and properly cleaned up on unmount.
- Fix the order execution flow in `usePositionStorage.ts`, `useAITradeGeneration.ts`, and `binanceOrderService.ts` so that when Live Trading mode is ON, real MARKET, TAKE_PROFIT_MARKET, and STOP_MARKET orders are sent to Binance Futures (`https://fapi.binance.com/fapi/v1/order`).
- Wrap each individual order call in try/catch so a failure in one order does not abort the others, and surface results via toast notifications.

**User-visible outcome:** Users can toggle Live Trading mode ON without the app freezing or becoming unresponsive. When Live Trading mode is active with valid Binance credentials, real orders are placed on Binance Futures and the user receives toast feedback on success or failure.
