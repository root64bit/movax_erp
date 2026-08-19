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

  describe('Stock Transfer State Machine & Invariants', () => {
    type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

    interface TransferState {
      status: TransferStatus;
      originStock: number;
      transitStock: number;
      destStock: number;
      qty: number;
    }

    function dispatchTransfer(state: TransferState): TransferState {
      if (state.status !== 'PENDING') throw new Error('Only PENDING transfers can be dispatched');
      if (state.originStock < state.qty) throw new Error('Insufficient origin stock');
      return {
        ...state,
        status: 'IN_TRANSIT',
        originStock: state.originStock - state.qty,
        transitStock: state.transitStock + state.qty,
      };
    }

    function receiveTransfer(state: TransferState): TransferState {
      if (state.status !== 'IN_TRANSIT') throw new Error('Only IN_TRANSIT transfers can be received');
      return {
        ...state,
        status: 'RECEIVED',
        transitStock: state.transitStock - state.qty,
        destStock: state.destStock + state.qty,
      };
    }

    function cancelTransfer(state: TransferState): TransferState {
      if (state.status === 'RECEIVED') throw new Error('RECEIVED_TRANSFER_CANNOT_BE_CANCELLED');
      if (state.status === 'CANCELLED') return state; // Idempotent
      if (state.status === 'PENDING') {
        return { ...state, status: 'CANCELLED' };
      }
      if (state.status === 'IN_TRANSIT') {
        // Atomic stock reversal back to origin warehouse
        return {
          ...state,
          status: 'CANCELLED',
          originStock: state.originStock + state.qty,
          transitStock: state.transitStock - state.qty,
        };
      }
      return state;
    }

    it('executes standard lifecycle: PENDING -> IN_TRANSIT -> RECEIVED', () => {
      let state: TransferState = { status: 'PENDING', originStock: 10, transitStock: 0, destStock: 2, qty: 4 };
      state = dispatchTransfer(state);
      expect(state.status).toBe('IN_TRANSIT');
      expect(state.originStock).toBe(6);
      expect(state.transitStock).toBe(4);
      expect(state.destStock).toBe(2);

      state = receiveTransfer(state);
      expect(state.status).toBe('RECEIVED');
      expect(state.originStock).toBe(6);
      expect(state.transitStock).toBe(0);
      expect(state.destStock).toBe(6);
    });

    it('cancels PENDING transfer without altering stock', () => {
      const state: TransferState = { status: 'PENDING', originStock: 10, transitStock: 0, destStock: 0, qty: 5 };
      const cancelled = cancelTransfer(state);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.originStock).toBe(10);
      expect(cancelled.transitStock).toBe(0);
    });

    it('cancels IN_TRANSIT transfer with atomic reversal to origin', () => {
      let state: TransferState = { status: 'PENDING', originStock: 20, transitStock: 0, destStock: 0, qty: 8 };
      state = dispatchTransfer(state);
      expect(state.originStock).toBe(12);
      expect(state.transitStock).toBe(8);

      state = cancelTransfer(state);
      expect(state.status).toBe('CANCELLED');
      expect(state.originStock).toBe(20); // Restored!
      expect(state.transitStock).toBe(0); // Cleared!
    });

    it('strictly rejects cancelling a RECEIVED transfer', () => {
      let state: TransferState = { status: 'PENDING', originStock: 10, transitStock: 0, destStock: 0, qty: 3 };
      state = dispatchTransfer(state);
      state = receiveTransfer(state);
      expect(state.status).toBe('RECEIVED');

      expect(() => cancelTransfer(state)).toThrow('RECEIVED_TRANSFER_CANNOT_BE_CANCELLED');
    });

    it('strictly rejects double-receive on already received transfer', () => {
      let state: TransferState = { status: 'PENDING', originStock: 10, transitStock: 0, destStock: 0, qty: 3 };
      state = dispatchTransfer(state);
      state = receiveTransfer(state);

      expect(() => receiveTransfer(state)).toThrow('Only IN_TRANSIT transfers can be received');
    });
  });
});
