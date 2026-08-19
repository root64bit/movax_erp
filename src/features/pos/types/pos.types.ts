import type { Article, SaleInvoice, SaleItem, Client, ReferenceOption, DocumentRecord, AccessScope } from '@/shared/types/domain.types';

export type PosDocumentType = 'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE';
export type PosDocStatus = 'PREPARATION' | 'CONFIRMING' | 'CONFIRMED' | 'READ_ONLY';

export interface PosProps {
  articles: Article[];
  clients: Client[];
  sales?: SaleInvoice[];
  onCompleteSale: (sale: SaleInvoice) => Promise<SaleInvoice>;
  onOpenPrintModal: (sale: SaleInvoice) => void;
  canReceivePayment: boolean;
  operatorName: string;
  paymentTerms: ReferenceOption[];
  paymentMethods: ReferenceOption[];
  documents?: DocumentRecord[];
  permissions?: string[];
  warehouseId?: string;
  warehouses?: AccessScope[];
  canViewCost?: boolean;
  canAllowNegative?: boolean;
  onUpdateDocument?: (
    documentId: string,
    payload: {
      documentDate?: string;
      clientName?: string;
      clientNuit?: string;
      clientAddress?: string;
      grandTotal?: number;
      notes?: string;
      items?: SaleItem[];
      generalDiscount?: number;
      keepAsWalkIn?: boolean;
    }
  ) => Promise<void>;
}
