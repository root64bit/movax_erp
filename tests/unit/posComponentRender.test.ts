import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PosEditSaleModal } from '../../src/features/pos/components/PosEditSaleModal';
import { PosHeader } from '../../src/features/pos/components/PosHeader';
import { PosCustomerSection } from '../../src/features/pos/components/PosCustomerSection';
import type { SaleInvoice, Article, Client, ReferenceOption } from '../../src/shared/types/domain.types';

describe('Real POS Component Render & Fiscal Value Inspection', () => {
  const dummyArticles: Article[] = [
    {
      id: 'art-0',
      code: 'ZERO01',
      description: 'Artigo Isento 0%',
      unit: 'UN',
      stock: 10,
      minStock: 1,
      costPrice: 50,
      sellPrice: 100,
      sellPriceWithIva: 100,
      taxRate: 0,
      category: 'Geral',
    },
  ];

  it('renders PosEditSaleModal with 0% VAT line and verifies input contains value="0"', () => {
    const saleWithZeroVat: SaleInvoice = {
      id: 'sale-zero',
      docNumber: 'FT-2026/001',
      date: '2026-08-19',
      clientName: 'Cliente Isento',
      clientNuit: '',
      clientAddress: '',
      paymentMethod: 'CASH',
      sellerName: 'Operador',
      items: [
        {
          articleId: 'art-0',
          code: 'ZERO01',
          description: 'Artigo Isento 0%',
          quantity: 2,
          unitPrice: 100,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: 0, // MUST RENDER AS 0, NOT 16!
          total: 200,
          lineType: 'STOCK',
        },
      ],
      subtotalBruto: 200,
      descontoTotal: 0,
      subtotalLiquido: 200,
      ivaTotal: 0,
      totalAmount: 200,
      paidAmount: 200,
      pendingAmount: 0,
      status: 'Concluída',
    };

    const html = renderToString(
      React.createElement(PosEditSaleModal, {
        editingSale: saleWithZeroVat,
        articles: dummyArticles,
        articleSearchLoader: async () => dummyArticles,
        onClose: () => {},
        onUpdateDocument: async () => {},
      })
    );

    expect(html).toContain('value="0"');
    expect(html).toContain('200,00 MT');
    expect(html).toContain('Artigo Isento 0%');
  });

  it('renders PosEditSaleModal with 16% VAT line and verifies input contains value="16"', () => {
    const saleWith16Vat: SaleInvoice = {
      id: 'sale-16',
      docNumber: 'FT-2026/002',
      date: '2026-08-19',
      clientName: 'Cliente Normal',
      clientNuit: '',
      clientAddress: '',
      paymentMethod: 'CASH',
      sellerName: 'Operador',
      items: [
        {
          articleId: 'art-16',
          code: 'STD16',
          description: 'Artigo Standard 16%',
          quantity: 1,
          unitPrice: 116,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: 16,
          total: 116,
          lineType: 'STOCK',
        },
      ],
      subtotalBruto: 100,
      descontoTotal: 0,
      subtotalLiquido: 100,
      ivaTotal: 16,
      totalAmount: 116,
      paidAmount: 116,
      pendingAmount: 0,
      status: 'Concluída',
    };

    const html = renderToString(
      React.createElement(PosEditSaleModal, {
        editingSale: saleWith16Vat,
        articles: dummyArticles,
        articleSearchLoader: async () => dummyArticles,
        onClose: () => {},
        onUpdateDocument: async () => {},
      })
    );

    expect(html).toContain('value="16"');
    expect(html).toContain('116,00 MT');
  });

  it('renders PosEditSaleModal with 5% VAT line and verifies input contains value="5"', () => {
    const saleWith5Vat: SaleInvoice = {
      id: 'sale-5',
      docNumber: 'FT-2026/003',
      date: '2026-08-19',
      clientName: 'Cliente Taxa 5%',
      clientNuit: '',
      clientAddress: '',
      paymentMethod: 'CASH',
      sellerName: 'Operador',
      items: [
        {
          articleId: 'art-5',
          code: 'RED05',
          description: 'Artigo Taxa 5%',
          quantity: 1,
          unitPrice: 105,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: 5,
          total: 105,
          lineType: 'STOCK',
        },
      ],
      subtotalBruto: 100,
      descontoTotal: 0,
      subtotalLiquido: 100,
      ivaTotal: 5,
      totalAmount: 105,
      paidAmount: 105,
      pendingAmount: 0,
      status: 'Concluída',
    };

    const html = renderToString(
      React.createElement(PosEditSaleModal, {
        editingSale: saleWith5Vat,
        articles: dummyArticles,
        articleSearchLoader: async () => dummyArticles,
        onClose: () => {},
        onUpdateDocument: async () => {},
      })
    );

    expect(html).toContain('value="5"');
    expect(html).toContain('105,00 MT');
  });

  it('renders PosHeader with Guia Only user disabling invoice buttons', () => {
    const html = renderToString(
      React.createElement(PosHeader, {
        documentType: 'CUSTOMER_DELIVERY_NOTE',
        docStatus: 'PREPARATION',
        docNumber: 'A atribuir ao confirmar',
        isGuiaOnlyUser: true,
        onSelectDocumentType: () => {},
        onResetForm: () => {},
      })
    );

    // Factura button must be disabled
    expect(html).toContain('disabled=""');
    expect(html).toContain('Apenas o Administrador pode emitir Faturas');
    expect(html).toContain('Guia de Remessa');
  });
});
