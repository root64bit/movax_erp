import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StockMovements } from '../../src/features/stock-transfers/pages/StockMovementsPage';
import type { AccessScope, Article, Supplier, StockMovement } from '../../src/shared/types/domain.types';

describe('StockMovements Page Component Render & UI Freeze Contract', () => {
  const dummyWarehouses: AccessScope[] = [
    { id: 'wh-1', name: 'Armazém Central' },
    { id: 'wh-2', name: 'Loja Baixa' },
  ];

  const dummyArticles: Article[] = [
    {
      id: 'art-1',
      code: 'PNEU-01',
      description: 'Pneu Radial 175/70 R13',
      unit: 'UN',
      stock: 45,
      minStock: 10,
      costPrice: 1500,
      sellPrice: 2200,
      taxRate: 16,
      category: 'Pneus',
    },
  ];

  const dummySuppliers: Supplier[] = [
    {
      id: 'sup-1',
      name: 'Distribuidora Central, Lda',
      email: 'geral@distcentral.co.mz',
      phone: '840000000',
      address: 'Maputo',
      taxNumber: '400999888',
      balance: 0,
      pendingBalance: 0,
    },
  ];

  const dummyMovements: StockMovement[] = [
    {
      id: 'mov-1',
      date: '2026-08-20T08:00:00Z',
      type: 'entrada',
      articleId: 'art-1',
      articleCode: 'PNEU-01',
      articleDescription: 'Pneu Radial 175/70 R13',
      quantity: 10,
      balanceAfter: 45,
      docRef: 'GUIA-2026/001',
    },
  ];

  it('renders direct entrada workspace mode correctly with all operational controls', () => {
    const html = renderToString(
      React.createElement(StockMovements, {
        movements: dummyMovements,
        articles: dummyArticles,
        suppliers: dummySuppliers,
        warehouses: dummyWarehouses,
        operatorName: 'Operador Almoxarifado',
        onSaveGuide: vi.fn(),
        onCancelGuide: vi.fn(),
        canPostEntry: true,
        canPostExit: true,
        canAllowNegative: false,
        canViewCost: true,
        canCancelGuide: true,
        canTransfer: true,
      })
    );

    expect(html).toContain('Movimentar stock');
    expect(html).toContain('Entrada de stock');
    expect(html).toContain('Armazém Central');
    expect(html).toContain('Gravar e Confirmar Guia (F2)');
    expect(html).toContain('Histórico Oficial de Movimentos de Stock');
    expect(html).toContain('Exportar CSV');
  });

  it('renders permission guards properly when user only has exit permission', () => {
    const html = renderToString(
      React.createElement(StockMovements, {
        movements: dummyMovements,
        articles: dummyArticles,
        suppliers: dummySuppliers,
        warehouses: dummyWarehouses,
        operatorName: 'Operador Balcão',
        onSaveGuide: vi.fn(),
        onCancelGuide: vi.fn(),
        canPostEntry: false,
        canPostExit: true,
        canAllowNegative: false,
        canViewCost: false,
        canCancelGuide: false,
        canTransfer: false,
      })
    );

    // Entrada tab should not be rendered
    expect(html).toContain('Saída de stock');
    expect(html).not.toContain('Custo Unit.');
  });
});
