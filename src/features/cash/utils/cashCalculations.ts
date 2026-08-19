export interface CashMovementInput {
  type: 'OPENING' | 'REINFORCEMENT' | 'WITHDRAWAL' | 'SALE' | 'SUPPLIER_PAYMENT';
  amount: number;
}

export function calculateExpectedCash(
  openingAmount: number,
  movements: CashMovementInput[]
): number {
  let total = openingAmount;
  for (const m of movements) {
    if (m.type === 'REINFORCEMENT' || m.type === 'SALE') {
      total += m.amount;
    } else if (m.type === 'WITHDRAWAL' || m.type === 'SUPPLIER_PAYMENT') {
      total -= m.amount;
    }
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function calculateCashDifference(
  countedAmount: number,
  expectedAmount: number
): { difference: number; status: 'EXACT' | 'SURPLUS' | 'SHORTAGE' } {
  const diff = Math.round((countedAmount - expectedAmount + Number.EPSILON) * 100) / 100;
  if (diff === 0) return { difference: 0, status: 'EXACT' };
  if (diff > 0) return { difference: diff, status: 'SURPLUS' };
  return { difference: Math.abs(diff), status: 'SHORTAGE' };
}
