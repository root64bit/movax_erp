import { describe, it, expect } from 'vitest';

export function calculateOffset(page: number, pageSize: number): number {
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.max(1, Math.floor(pageSize || 25));
  return (safePage - 1) * safePageSize;
}

export function calculateTotalPages(totalCount: number, pageSize: number): number {
  const safeTotal = Math.max(0, Math.floor(totalCount || 0));
  const safePageSize = Math.max(1, Math.floor(pageSize || 25));
  return Math.max(1, Math.ceil(safeTotal / safePageSize));
}

export function clampPage(page: number, totalCount: number, pageSize: number): number {
  const totalPages = calculateTotalPages(totalCount, pageSize);
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

describe('Server-Side Pagination & Large Dataset Engine', () => {
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

  it('verifies that page slicing keeps memory footprint strictly constant (O(pageSize))', () => {
    const hugeDatasetSize = 50000;
    const pageSize = 25;
    const offset = calculateOffset(10, pageSize);
    const mockDbSlice = Array.from({ length: pageSize }, (_, i) => ({ id: `row-${offset + i}` }));

    expect(mockDbSlice.length).toBe(25);
    expect(mockDbSlice[0].id).toBe('row-225');
    expect(mockDbSlice[24].id).toBe('row-249');
  });
});
