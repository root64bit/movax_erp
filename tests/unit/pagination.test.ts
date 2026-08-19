import { describe, it, expect } from 'vitest';
import {
  calculateOffset,
  calculateTotalPages,
  clampPage,
  sanitizePostgrestSearch,
} from '@/shared/utils/pagination';

describe('Server-Side Pagination & Large Dataset Engine (Production Utility)', () => {
  it('calculates deterministic offsets across pagination pages', () => {
    expect(calculateOffset(1, 25)).toBe(0);
    expect(calculateOffset(2, 25)).toBe(25);
    expect(calculateOffset(3, 25)).toBe(50);
    expect(calculateOffset(10, 50)).toBe(450);
    expect(calculateOffset(100, 100)).toBe(9900);
  });

  it('handles edge-cases safely for negative or zero page/pageSize', () => {
    expect(calculateOffset(0, 25)).toBe(0);
    expect(calculateOffset(-5, 25)).toBe(0);
    expect(calculateOffset(1, 0)).toBe(0);
  });

  it('calculates total pages accurately for small and large enterprise datasets', () => {
    // 0 items -> 1 page (empty state)
    expect(calculateTotalPages(0, 25)).toBe(1);
    // Exact multiple: 50 items / 25 pageSize -> 2 pages
    expect(calculateTotalPages(50, 25)).toBe(2);
    // Non-exact: 51 items / 25 pageSize -> 3 pages
    expect(calculateTotalPages(51, 25)).toBe(3);
    // Enterprise volume: 25,431 products with 25 per page -> 1018 pages
    expect(calculateTotalPages(25431, 25)).toBe(1018);
    // Enterprise volume: 500,000 movements with 100 per page -> 5000 pages
    expect(calculateTotalPages(500000, 100)).toBe(5000);
  });

  it('clamps active page when filtered results shrink', () => {
    // User is on page 50, but after filter only 100 items match (4 pages total)
    expect(clampPage(50, 100, 25)).toBe(4);
    // User is on page -3
    expect(clampPage(-3, 100, 25)).toBe(1);
    // User is on page 2 out of 5
    expect(clampPage(2, 100, 25)).toBe(2);
  });

  it('sanitizes special PostgREST characters safely for search queries', () => {
    expect(sanitizePostgrestSearch('Mário & Filhos, Lda.')).toBe('Mário & Filhos Lda.');
    expect(sanitizePostgrestSearch('Auto (Maputo)')).toBe('Auto Maputo');
    expect(sanitizePostgrestSearch('100% Cotton_Fabric')).toBe('100 CottonFabric');
    expect(sanitizePostgrestSearch('   Test   Query   ')).toBe('Test Query');
    expect(sanitizePostgrestSearch('')).toBe('');
  });
});
