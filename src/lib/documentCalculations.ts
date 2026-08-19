import type { SaleItem } from '../types';

export const roundMoney = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export interface CalculatedLine {
  grossWithTax: number;
  discountAmount: number;
  totalWithTax: number;
  unitPriceExcludingTax: number;
  netAmount: number;
  taxAmount: number;
}

export function calculateDocumentLine(item: Pick<SaleItem, 'quantity' | 'unitPrice' | 'discountAmount' | 'discountPercent' | 'ivaPercent'>): CalculatedLine {
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const unitPriceWithTax = Math.max(0, Number(item.unitPrice) || 0);
  const taxRate = Math.max(0, Number(item.ivaPercent) || 0);
  const grossWithTax = roundMoney(quantity * unitPriceWithTax);
  const legacyDiscount = grossWithTax * Math.max(0, Number(item.discountPercent) || 0) / 100;
  const requestedDiscount = item.discountAmount === undefined
    ? legacyDiscount
    : Math.max(0, Number(item.discountAmount) || 0);
  const discountAmount = roundMoney(Math.min(grossWithTax, requestedDiscount));
  const totalWithTax = roundMoney(grossWithTax - discountAmount);
  const divisor = 1 + taxRate / 100;
  const netAmount = divisor > 0 ? roundMoney(totalWithTax / divisor) : totalWithTax;
  const taxAmount = roundMoney(totalWithTax - netAmount);
  const unitPriceExcludingTax = divisor > 0 ? roundMoney(unitPriceWithTax / divisor) : unitPriceWithTax;

  return {
    grossWithTax,
    discountAmount,
    totalWithTax,
    unitPriceExcludingTax,
    netAmount,
    taxAmount,
  };
}

export function recalculateSaleItem(item: SaleItem): SaleItem {
  const calculated = calculateDocumentLine(item);
  return {
    ...item,
    quantity: Math.max(0, Number(item.quantity) || 0),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    discountAmount: calculated.discountAmount,
    discountPercent: calculated.grossWithTax > 0
      ? roundMoney(calculated.discountAmount / calculated.grossWithTax * 100)
      : 0,
    ivaPercent: Math.max(0, Number(item.ivaPercent) || 0),
    total: calculated.totalWithTax,
  };
}

export function recalculateSaleItems(items: SaleItem[]): SaleItem[] {
  return items.map(recalculateSaleItem);
}

export function calculateDocumentTotals(items: SaleItem[], generalDiscountAmount = 0) {
  const lines = recalculateSaleItems(items);
  const grossTotal = roundMoney(lines.reduce((sum, line) => sum + calculateDocumentLine(line).grossWithTax, 0));
  const lineDiscountTotal = roundMoney(lines.reduce((sum, line) => sum + (line.discountAmount || 0), 0));
  const beforeGeneralDiscount = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
  const generalDiscount = roundMoney(Math.min(beforeGeneralDiscount, Math.max(0, Number(generalDiscountAmount) || 0)));
  const factor = beforeGeneralDiscount > 0 ? (beforeGeneralDiscount - generalDiscount) / beforeGeneralDiscount : 0;
  const netBeforeGeneral = lines.reduce((sum, line) => sum + calculateDocumentLine(line).netAmount, 0);
  const taxBeforeGeneral = lines.reduce((sum, line) => sum + calculateDocumentLine(line).taxAmount, 0);
  const netTotal = roundMoney(netBeforeGeneral * factor);
  const taxTotal = roundMoney(taxBeforeGeneral * factor);
  const grandTotal = roundMoney(beforeGeneralDiscount - generalDiscount);

  return {
    lines,
    grossTotal,
    lineDiscountTotal,
    generalDiscount,
    discountTotal: roundMoney(lineDiscountTotal + generalDiscount),
    netTotal,
    taxTotal: roundMoney(grandTotal - netTotal),
    grandTotal,
  };
}

export function isUuid(value?: string): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}
