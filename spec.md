# Specification

## Summary
**Goal:** Auto-load and use Binance credentials on app start for seamless credential-driven operation, including auto-importing positions, periodic background sync, onboarding guidance, and auto-filling total capital from the Binance account balance.

**Planned changes:**
- On app mount, check for stored Binance credentials; if present, automatically import open USD-M Futures positions into the position list (skip duplicates) and show a toast with the import count or an error message. Runs once per session.
- After the user saves Binance API credentials in BinanceCredentialsPanel for the first time, immediately trigger an automatic position import, show a combined confirmation toast, and switch the active tab to Dashboard.
- Add a 60-second background sync loop that activates when credentials are present and Live Trading mode is ON: adds new positions from Binance, removes closed ones from the local list, and shows a toast only when the list changes.
- Display a prominent onboarding banner in the Dashboard tab when no credentials are configured, with an "Open Settings" button that opens the SettingsDialog. The banner disappears reactively when credentials are saved (via the `credential-change` DOM event).
- On app load with credentials present, fetch `totalWalletBalance` from the Binance USD-M Futures account endpoint and auto-fill `total_capital` in localStorage only if it is currently unset or zero, showing a confirmation toast when auto-filled.

**User-visible outcome:** Users with saved Binance credentials will have their open positions and account balance automatically loaded on app start, kept in sync in the background, and guided through onboarding if credentials are missing — all without manual import steps.
