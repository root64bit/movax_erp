import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [15, 25, 50, 100],
}) => {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-100 dark:bg-[#282c2e] border-t border-[#c3c6d1] dark:border-[#43474f] text-xs font-mono">
      <div className="flex items-center gap-3">
        <span className="text-slate-600 dark:text-slate-300">
          Mostrando <b>{startItem}</b>–<b>{endItem}</b> de <b>{totalItems}</b> registos (Página <b>{currentPage}</b> de <b>{totalPages}</b>)
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded px-1.5 py-0.5 text-xs font-bold"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} por pág.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="px-2 py-1 rounded bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] font-bold hover:bg-slate-200 disabled:opacity-30"
        >
          « Primeira
        </button>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-2.5 py-1 rounded bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] font-bold hover:bg-slate-200 disabled:opacity-30"
        >
          ‹ Anterior
        </button>
        <span className="px-3 py-1 font-bold text-[#003366] dark:text-[#a7c8ff]">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-2.5 py-1 rounded bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] font-bold hover:bg-slate-200 disabled:opacity-30"
        >
          Seguinte ›
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="px-2 py-1 rounded bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] font-bold hover:bg-slate-200 disabled:opacity-30"
        >
          Última »
        </button>
      </div>
    </div>
  );
};
