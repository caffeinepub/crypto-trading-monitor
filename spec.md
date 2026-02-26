# Specification

## Summary
**Goal:** Rebuild the entire application from scratch as a focused Binance USD-M Futures order terminal, with a Motoko backend canister acting as an authenticated HTTP outcall proxy for order placement, and a minimal React + TypeScript frontend with only three tabs: Dashboard, Order Terminal, and Settings.

**Planned changes:**
- Create a Motoko backend canister (`backend/main.mo`) that exposes `placeMarketOrder`, `placeLimitOrder`, `placeStopMarketOrder`, `placeTakeProfitMarketOrder`, and `cancelOrder` methods — each appending a timestamp, computing HMAC-SHA256 signature, and forwarding the request to Binance Futures API without persisting credentials
- Build a fresh React + TypeScript frontend with three tabs: Dashboard, Order Terminal, and Settings — discarding all previous code
- Implement `frontend/src/services/binanceProxyService.ts` that reads credentials from localStorage and delegates all authenticated order calls to the Motoko canister
- Implement `frontend/src/utils/credentialsStorage.ts` for localStorage credential management with a `credential-change` DOM event dispatched on every write
- Build `DashboardTab.tsx` showing imported open positions with live PnL polled every 5 seconds, an Import Positions button (proxy-authenticated), per-card Remove button, and an onboarding banner when credentials are absent
- Build `OrderTerminalTab.tsx` with a perpetual pair selector (from Binance exchangeInfo), live price display, order type/side/quantity/price/stop-price inputs, and a Place Order button disabled when Live Trading mode is OFF
- Build `SettingsTab.tsx` with API credential inputs, Save/Clear buttons, a Test Connection button (via proxy with 15-second timeout), and a Live Trading toggle with confirmation dialog
- Apply a dark trading terminal aesthetic using Tailwind CSS with near-black background, gold/amber accents, green/red PnL colors, monospace fonts for numeric data, and a sticky header with credential status and live trading badge
