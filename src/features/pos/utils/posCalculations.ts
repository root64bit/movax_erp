import type { Client, SaleItem } from '@/shared/types/domain.types';

export const normalizeClientSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-PT');

export const isWalkInClient = (client: Client): boolean => {
  const code = String(client.number || client.code || '').trim();
  const name = normalizeClientSearch(client.name || '');
  return code === '1' || name.includes('pontual') || name.includes('cliente final') || name.includes('consumidor');
};

export interface CalculatedTotals {
  subtotal: number;
  totalVat: number;
  totalDiscount: number;
  grandTotal: number;
}

export function calculatePosTotals(
  items: SaleItem[],
  generalDiscountPercent = 0
): CalculatedTotals {
  let subtotal = 0;
  let totalVat = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const discPercent = Number(item.discountPercent) || 0;
    const vatRate = (Number(item.ivaPercent) || 16) / 100;

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

  const roundedSubtotal = round2(subtotal);
  const roundedVat = round2(totalVat);
  const roundedDiscount = round2(totalDiscount);
  const grandTotal = round2(roundedSubtotal + roundedVat);

  return {
    subtotal: roundedSubtotal,
    totalVat: roundedVat,
    totalDiscount: roundedDiscount,
    grandTotal,
  };
}

export function calculateChange(paidAmount: number, grandTotal: number): number {
  const diff = paidAmount - grandTotal;
  return diff > 0 ? Math.round((diff + Number.EPSILON) * 100) / 100 : 0;
}
