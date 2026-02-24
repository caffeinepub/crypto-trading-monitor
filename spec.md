# Specification

## Summary
**Goal:** Reorganize the Crypto Position Monitor app into a four-tab navigation layout without changing any existing component logic or styling.

**Planned changes:**
- Add a persistent tab bar below the app header with four tabs: Dashboard, AI Daily Trades, AI Insights, and Risk Management
- Keep the header (logo, install button, capital summary) always visible above the tab bar
- **Dashboard tab** (default): TotalCapitalSummary, PositionEntryForm, and PositionDashboard
- **AI Daily Trades tab**: AIDailyTradesSummary banner and AIDailyTradesSection with all four modality trade cards
- **AI Insights tab**: Per-position groupings of SentimentGauge, TrendPredictionCard, and AdjustmentSuggestionCard; shows empty-state message when no positions exist
- **Risk Management tab**: PositionSizeCalculator, PortfolioExposureDashboard, and ScenarioSimulator in a responsive layout
- Tab bar styled with the existing golden accent theme; active tab clearly highlighted

**User-visible outcome:** Users can switch between four organized tabs to access their active positions/dashboard, AI daily trades, AI insights per position, and risk management tools, all within the existing golden-themed design.
