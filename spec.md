# Specification

## Summary
**Goal:** Enhance the Risk Management tab with live Binance Futures API data across all its components.

**Planned changes:**
- Update `PositionSizeCalculator` to fetch live current price from Binance ticker API for the selected symbol and display it as a reference next to the entry price field; fetch leverage bracket data to show max allowed leverage and maintenance margin rate; warn if chosen leverage exceeds the symbol's maximum allowed leverage.
- Update `PortfolioExposureDashboard` and `usePortfolioExposure` hook to fetch live prices for all tracked symbols, calculate real-time unrealized PnL, current exposure (quantity × live price), and distance to liquidation price per position; refresh every 30 seconds; show stale data indicator on fetch failure.
- Update `ScenarioSimulator` and `scenarioSimulator` utility to use live Binance prices as the simulation baseline; fetch recent kline data to compute ATR-based volatility presets ("1-day ATR", "3-day ATR") as additional preset buttons; display the live baseline price in the results panel; fall back to entry price with a warning on failure.
- Add a new "Live Risk Metrics" summary card at the top of `RiskManagementTab` showing per-position estimated liquidation price, distance to liquidation as a percentage, and color-coded risk badges (green >20%, amber 10–20%, red <10%); include a portfolio-level summary row aggregating positions by risk level; refresh every 30 seconds.
- All Binance API failures must be handled gracefully with fallback values or user-facing error messages.

**User-visible outcome:** The Risk Management tab displays real-time Binance data throughout — live prices, leverage limits, unrealized PnL, liquidation estimates, ATR-based scenario presets, and a color-coded live risk summary card at the top — all refreshing automatically every 30 seconds.
