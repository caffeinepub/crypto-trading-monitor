/**
 * totalCapitalStorage.ts
 * Manages total trading capital in localStorage.
 * Dispatches 'total-capital-change' custom DOM event after every write
 * so that any component displaying total capital can update reactively.
 *
 * Custom DOM events dispatched:
 *   - 'total-capital-change': when total capital is saved or cleared
 */

const TOTAL_CAPITAL_KEY = 'total_trading_capital';

/**
 * Reads the total_capital value from localStorage.
 * Returns the numeric value, or null if unset/invalid.
 */
export function getTotalCapital(): number | null {
  try {
    const raw = localStorage.getItem(TOTAL_CAPITAL_KEY);
    if (!raw) return null;
    const value = parseFloat(raw);
    return isNaN(value) ? null : value;
  } catch {
    return null;
  }
}

/**
 * Reads the total_capital value from localStorage.
 * Returns the numeric value, or 0 if unset/null/invalid.
 * Useful for checking whether capital has been set before auto-filling.
 */
export function getTotalCapitalOrZero(): number {
  return getTotalCapital() ?? 0;
}

export function setTotalCapital(value: number): void {
  try {
    localStorage.setItem(TOTAL_CAPITAL_KEY, value.toString());
    // Dispatch event so all listening components update reactively
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('total-capital-change'));
    }, 0);
  } catch {
    // Ignore storage errors
  }
}

export function validateTotalCapital(value: number): boolean {
  return !isNaN(value) && value > 0 && value < 1_000_000_000;
}
