const STORAGE_KEY = 'total_capital';

export function getTotalCapital(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const value = parseFloat(stored);
    return isNaN(value) || value <= 0 ? null : value;
  } catch (error) {
    console.error('Error reading total capital from localStorage:', error);
    return null;
  }
}

export function setTotalCapital(value: number): boolean {
  if (!validateTotalCapital(value)) {
    return false;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, value.toString());
    return true;
  } catch (error) {
    console.error('Error saving total capital to localStorage:', error);
    return false;
  }
}

export function validateTotalCapital(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}
