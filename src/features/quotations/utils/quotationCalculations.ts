import type { SaleItem } from '@/shared/types/domain.types';

export interface CalculatedQuotationTotals {
  subtotal: number;
  totalVat: number;
  totalDiscount: number;
  grandTotal: number;
}

export function calculateQuotationTotals(
  items: SaleItem[],
  generalDiscountPercent = 0,
  defaultVatRate = 16
): CalculatedQuotationTotals {
  let subtotal = 0;
  let totalVat = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const discPercent = Number(item.discountPercent) || 0;
    const vatRate = (Number(item.ivaPercent) || defaultVatRate) / 100;

    const baseAmount = qty * price;
    const lineDiscount = baseAmount * (discPercent / 100);
    const amountAfterLineDisc = baseAmount - lineDiscount;

    const generalDiscAmount = amountAfterLineDisc * (generalDiscountPercent / 100);
    const taxableAmount = amountAfterLineDisc - generalDiscAmount;
    const vatAmount = taxableAmount * vatRate;

    subtotal += taxableAmount;
    totalVat += vatAmount;
    totalDiscount += lineDiscount + generalDiscAmount;
  }

  const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

  return {
    subtotal: round2(subtotal),
    totalVat: round2(totalVat),
    totalDiscount: round2(totalDiscount),
    grandTotal: round2(round2(subtotal) + round2(totalVat)),
  };
}
