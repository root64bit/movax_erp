import { describe, it, expect } from 'vitest';
import { calculateAvailableStock, calculateWeightedAverageCost, calculateStockAdjustmentVariance } from '../../src/features/inventory/utils/stockCalculations';

describe('Stock & CMP Calculations Engine', () => {
  it('calculates available stock respecting reservations', () => {
    expect(calculateAvailableStock(100, 20)).toBe(80);
    expect(calculateAvailableStock(10, 15)).toBe(0); // Never returns negative available stock
    expect(calculateAvailableStock(50, 0)).toBe(50);
  });

  it('calculates Weighted Average Cost (CMP) accurately upon stock intake', () => {
    // Current: 10 units @ 100 MZN = 1,000 MZN
    // Inflow:  10 units @ 150 MZN = 1,500 MZN
    // Total:   20 units, Total Value = 2,500 MZN -> New CMP = 125.00 MZN
    const newCost = calculateWeightedAverageCost(10, 100, 10, 150);
    expect(newCost).toBe(125);
  });

  it('calculates initial CMP when current stock is zero', () => {
    const newCost = calculateWeightedAverageCost(0, 0, 5, 250);
    expect(newCost).toBe(250);
  });

  it('calculates physical inventory variance (Quebras e Sobras)', () => {
    expect(calculateStockAdjustmentVariance(100, 100)).toEqual({ difference: 0, status: 'EXACT' });
    expect(calculateStockAdjustmentVariance(100, 105)).toEqual({ difference: 5, status: 'SURPLUS' });
    expect(calculateStockAdjustmentVariance(100, 92)).toEqual({ difference: 8, status: 'DEFICIT' });
  });
});
