export interface StockBalanceState {
  currentStock: number;
  reservedStock: number;
  currentAvgCost: number;
}

export function calculateAvailableStock(currentStock: number, reservedStock = 0): number {
  return Math.max(0, currentStock - reservedStock);
}

export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  newQuantity: number,
  newUnitCost: number
): number {
  if (newQuantity <= 0) return currentAvgCost;
  const existingValue = Math.max(0, currentStock) * Math.max(0, currentAvgCost);
  const incomingValue = newQuantity * Math.max(0, newUnitCost);
  const totalQuantity = Math.max(0, currentStock) + newQuantity;

  if (totalQuantity <= 0) return newUnitCost;
  return Math.round(((existingValue + incomingValue) / totalQuantity + Number.EPSILON) * 100) / 100;
}

export function calculateStockAdjustmentVariance(
  expectedStock: number,
  countedStock: number
): { difference: number; status: 'EXACT' | 'SURPLUS' | 'DEFICIT' } {
  const diff = countedStock - expectedStock;
  if (diff === 0) return { difference: 0, status: 'EXACT' };
  if (diff > 0) return { difference: diff, status: 'SURPLUS' };
  return { difference: Math.abs(diff), status: 'DEFICIT' };
}
