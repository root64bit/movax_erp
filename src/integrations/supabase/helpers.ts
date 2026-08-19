import { AppError } from '@/shared/utils/errorUtils';

export function isUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function numberValue(val: unknown, defaultValue = 0): number {
  if (val === null || val === undefined || val === '') return defaultValue;
  const parsed = Number(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function stringValue(val: unknown, defaultValue = ''): string {
  if (val === null || val === undefined) return defaultValue;
  return String(val).trim();
}

export function booleanValue(val: unknown, defaultValue = false): boolean {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
  if (typeof val === 'number') return val === 1;
  return defaultValue;
}

export function handleSupabaseResult<T>(data: T | null, error: { message?: string; code?: string } | null, fallbackMessage = 'Falha na operação de base de dados.'): T {
  if (error) {
    throw new AppError(error.message || fallbackMessage, error.code || 'DB_ERROR');
  }
  if (data === null) {
    throw new AppError('Nenhum dado retornado do servidor.', 'NOT_FOUND', 404);
  }
  return data;
}
