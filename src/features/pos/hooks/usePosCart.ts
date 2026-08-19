import { useState, useMemo, useCallback } from 'react';
import type { SaleItem } from '@/shared/types/domain.types';
import { calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '@/lib/documentCalculations';

export interface UsePosCartReturn {
  items: SaleItem[];
  generalDiscount: number;
  notes: string;
  totals: ReturnType<typeof calculateDocumentTotals>;
  addItem: (item: SaleItem) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, item: Partial<SaleItem>) => void;
  setItems: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  setGeneralDiscount: React.Dispatch<React.SetStateAction<number>>;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  resetCart: () => void;
}

export function usePosCart(initialItems: SaleItem[] = []): UsePosCartReturn {
  const [items, setItems] = useState<SaleItem[]>(() => recalculateSaleItems(initialItems));
  const [generalDiscount, setGeneralDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const totals = useMemo(() => {
    return calculateDocumentTotals(items, generalDiscount);
  }, [items, generalDiscount]);

  const addItem = useCallback((item: SaleItem) => {
    const recalculated = recalculateSaleItem(item);
    setItems((prev) => [...prev, recalculated]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index: number, itemUpdates: Partial<SaleItem>) => {
    setItems((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const target = prev[index];
      const merged = recalculateSaleItem({ ...target, ...itemUpdates });
      const next = [...prev];
      next[index] = merged;
      return next;
    });
  }, []);

  const resetCart = useCallback(() => {
    setItems([]);
    setGeneralDiscount(0);
    setNotes('');
  }, []);

  return {
    items,
    generalDiscount,
    notes,
    totals,
    addItem,
    removeItem,
    updateItem,
    setItems,
    setGeneralDiscount,
    setNotes,
    resetCart,
  };
}
