/**
 * MOVAX ERP / POS - Enterprise Pagination & Query Utilities
 */

/**
 * Calculates zero-indexed database offset for 1-indexed UI page
 */
export function calculateOffset(page: number, pageSize: number): number {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));
  return (safePage - 1) * safePageSize;
}

/**
 * Calculates total pages from total record count and page size
 */
export function calculateTotalPages(totalCount: number, pageSize: number): number {
  const safeTotal = Math.max(0, Math.floor(Number(totalCount) || 0));
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 25));
  return Math.max(1, Math.ceil(safeTotal / safePageSize));
}

/**
 * Clamps a requested page within 1 and totalPages boundaries
 */
export function clampPage(page: number, totalCount: number, pageSize: number): number {
  const totalPages = calculateTotalPages(totalCount, pageSize);
  const safePage = Math.floor(Number(page) || 1);
  if (safePage < 1) return 1;
  if (safePage > totalPages) return totalPages;
  return safePage;
}

/**
 * Sanitizes input text for PostgREST .or(...) filter strings
 * Prevents syntax breaking on commas, parentheses, quotes, and wildcards
 */
export function sanitizePostgrestSearch(term: string): string {
  if (!term) return '';
  // Remove PostgREST operator characters that could break .or() expression syntax
  return term
    .replace(/[(),]/g, ' ')
    .replace(/[%_\\]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}
