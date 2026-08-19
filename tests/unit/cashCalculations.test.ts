import { describe, it, expect } from 'vitest';
import { calculateExpectedCash, calculateCashDifference } from '../../src/features/cash/utils/cashCalculations';

describe('Cash Session Management & Blind Closing', () => {
  it('calculates expected cash in drawer from initial float, sales, and sangrias', () => {
    const movements = [
      { type: 'SALE' as const, amount: 2500 },
      { type: 'REINFORCEMENT' as const, amount: 1000 },
      { type: 'WITHDRAWAL' as const, amount: 500 }, // Sangria
      { type: 'SUPPLIER_PAYMENT' as const, amount: 800 },
    ];
    // Initial float = 1000 MZN + 2500 + 1000 - 500 - 800 = 3200 MZN expected
    const expected = calculateExpectedCash(1000, movements);
    expect(expected).toBe(3200);
  });

  it('calculates cash variance on blind closing', () => {
    expect(calculateCashDifference(3200, 3200)).toEqual({ difference: 0, status: 'EXACT' });
    expect(calculateCashDifference(3250, 3200)).toEqual({ difference: 50, status: 'SURPLUS' });
    expect(calculateCashDifference(3150, 3200)).toEqual({ difference: 50, status: 'SHORTAGE' });
  });
});
