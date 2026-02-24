# Specification

## Summary
**Goal:** Apply a comprehensive set of stability fixes to the Crypto Position Monitor covering the Settings dialog, Live Trading toggle, Import from Binance button, order execution reliability, and reactive credential/live-trading state across all components.

**Planned changes:**
- Rewrite SettingsDialog open/close state in App.tsx using a simple local `useState` hook, wiring the gear icon directly to open the dialog with no intermediate handlers or blocking CSS.
- Completely refactor the Live Trading activation flow in `LiveTradingToggle.tsx` and `useLiveTradingMode.ts` to be fully non-blocking with async validation, AbortController timeouts (15s validation, 20s outer race), and proper `finally` cleanup so the toggle never stays stuck.
- Audit and fix all `useEffect` hooks and window event listeners in `useLiveTradingMode.ts`, `usePositionStorage.ts`, and `useAITradeGeneration.ts` to register exactly once, always clean up on unmount, and prevent cascading re-renders.
- Fix order execution in `usePositionStorage.ts` and `useAITradeGeneration.ts` so each Binance order call (`placeMarketOrder`, `placeTakeProfitMarketOrder`, `placeStopMarketOrder`) has its own try/catch with a 10-second timeout, positions are always saved to localStorage regardless of order failures, and specific toast notifications are shown for each outcome.
- Fix `authenticatedFetch` in `binanceAuth.ts` to reliably apply a 15-second timeout via AbortController, combine caller signals with the internal timeout, always clear the timeout in a `finally` block, and throw a typed `BinanceApiError` with code `REQUEST_TIMEOUT` on timeout.
- Fix the "Import from Binance" button in `DashboardTab.tsx` to reactively appear/disappear based on `hasCredentials()` by listening to the `credential-change` custom DOM event, removing any live-trading-mode guards from the visibility condition.
- Fix the "Test Connection" button in `BinanceCredentialsPanel.tsx` to never freeze, wrapping the fetch in try/catch/finally with a 15-second timeout and always re-enabling the button after success, error, or timeout.
- Ensure `CredentialStatusIndicator` in the app header subscribes to `credential-change` and `live-trading-change` DOM events to stay in sync without a page reload.
- Audit all components and hooks that read localStorage at initialization and replace with reactive patterns driven by `credential-change` and `live-trading-change` custom DOM events, including `LiveTradingBanner`.

**User-visible outcome:** The Settings dialog opens reliably from the gear icon on all tabs; the Live Trading toggle activates without freezing the UI under any network condition; the "Import from Binance" button appears immediately after saving credentials; Binance order placements show clear success/failure toasts and never block position saving; the credential and live trading status indicators update instantly without requiring a page reload.
