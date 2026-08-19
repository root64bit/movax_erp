/**
 * Centralized formatting utilities for Movax ERP.
 * Standardizes Mozambique Meticais (MZN), date/time, quantities, and phone numbers.
 */

export function formatMZN(value: number | string | null | undefined): string {
  const num = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(num)) return '0,00 MT';

  return new Intl.NumberFormat('pt-MZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(num)
    .concat(' MT');
}

export function formatQuantity(value: number | string | null | undefined, unit = 'UN'): string {
  const num = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(num)) return `0 ${unit}`;

  return new Intl.NumberFormat('pt-MZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
    .format(num)
    .concat(` ${unit}`);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('pt-MZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('pt-MZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 9) {
    return `(+258) ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

export function formatNUIT(nuit: string | null | undefined): string {
  if (!nuit) return '-';
  const clean = nuit.replace(/\D/g, '');
  if (clean.length === 9) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
  }
  return nuit;
}

export function formatPercentage(value: number | string | null | undefined): string {
  const num = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(num)) return '0%';
  return `${num.toFixed(1).replace('.0', '')}%`;
}
