import { useState, useEffect, useCallback } from 'react';
import type { StockMovement } from '@/shared/types/domain.types';
import type { StockTypeFilter } from '../types/stock-transfer.types';
import { InventoryService } from '@/features/inventory/services/inventory.service';
import { buildStockMovementsCsv } from '../utils/stockTransferState';

export interface UseStockMovementHistoryProps {
  initialMovements?: StockMovement[];
}

export function useStockMovementHistory({ initialMovements = [] }: UseStockMovementHistoryProps = {}) {
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPageSize, setMovementsPageSize] = useState(25);
  const [historyMovements, setHistoryMovements] = useState<StockMovement[]>(() => initialMovements || []);
  const [historyTotalCount, setHistoryTotalCount] = useState(() => initialMovements?.length || 0);
  const [historyTotalStock, setHistoryTotalStock] = useState(() => (initialMovements || []).reduce((sum, m) => sum + (m.quantity || 0), 0));
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<StockTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleClearFilters = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setTypeFilter('ALL');
    setSearchQuery('');
  }, []);

  const triggerHistoryRefresh = useCallback(() => {
    setHistoryRefreshKey((val) => val + 1);
  }, []);

  useEffect(() => {
    setMovementsPage(1);
  }, [dateFrom, dateTo, typeFilter, searchQuery, movementsPageSize]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setHistoryLoading(true);
      setHistoryError('');
      InventoryService.fetchStockMovementsPage(
        dateFrom,
        dateTo,
        typeFilter,
        searchQuery,
        movementsPageSize,
        (movementsPage - 1) * movementsPageSize
      )
        .then((result) => {
          if (cancelled) return;
          const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / movementsPageSize));
          if (movementsPage > lastAvailablePage) {
            setMovementsPage(lastAvailablePage);
            return;
          }
          setHistoryMovements(result.rows);
          setHistoryTotalCount(result.totalCount);
          setHistoryTotalStock(result.totalStock);
        })
        .catch((cause) => {
          if (!cancelled) {
            setHistoryError(cause instanceof Error ? cause.message : 'Falha ao carregar histórico de movimentos.');
          }
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false);
        });
    }, searchQuery ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dateFrom, dateTo, typeFilter, searchQuery, movementsPage, movementsPageSize, historyRefreshKey]);

  const exportMovementsToCSV = useCallback(() => {
    const csvContent = buildStockMovementsCsv(historyMovements);
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const dateSuffix = dateFrom || dateTo ? `_${dateFrom || 'inicio'}_a_${dateTo || 'hoje'}` : '';
    link.download = `movimentos-stock-pagina-${movementsPage}${dateSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [historyMovements, dateFrom, dateTo, movementsPage]);

  return {
    movementsPage,
    setMovementsPage,
    movementsPageSize,
    setMovementsPageSize,
    historyMovements,
    historyTotalCount,
    historyTotalStock,
    historyLoading,
    historyError,
    historyRefreshKey,
    triggerHistoryRefresh,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    handleClearFilters,
    exportMovementsToCSV,
  };
}
