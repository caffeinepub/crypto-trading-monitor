# Specification

## Summary
**Goal:** Remove the PositionEntryForm from the Dashboard tab so that importing from Binance is the only way to add positions.

**Planned changes:**
- Stop rendering the `PositionEntryForm` component inside `DashboardTab.tsx` (do not delete the component file).
- Ensure no empty whitespace or layout issues remain where the form previously appeared.
- Keep the "Import from Binance" button, `PositionDashboard`, and `TotalCapitalSummary` fully intact and functional.
- Update the empty state in `PositionDashboard` to prompt users to import from Binance rather than add manually.

**User-visible outcome:** The Dashboard tab no longer shows a manual position entry form; users can only add positions via the "Import from Binance" button.
