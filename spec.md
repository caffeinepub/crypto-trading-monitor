# Specification

## Summary
**Goal:** Fix the Position Size Calculator so its asset selector shows all Binance USD-M Futures perpetual pairs instead of a hardcoded or partial list.

**Planned changes:**
- Update `PositionSizeCalculator.tsx` to use the existing `useBinancePairs` hook to populate the asset dropdown/autocomplete with all perpetual pairs (contractType === 'PERPETUAL') from the Binance exchangeInfo endpoint.
- Display a loading indicator in the selector while pairs are being fetched.
- Display an error message if the fetch fails.
- Ensure the selected symbol continues to drive the live price and leverage bracket fetches already implemented in the component.

**User-visible outcome:** Users can search and select any Binance USD-M Futures perpetual pair in the Position Size Calculator, with loading and error feedback during data retrieval.
