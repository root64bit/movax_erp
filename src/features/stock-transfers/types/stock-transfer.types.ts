import type { AccessScope, Article, StockMovement, DocumentRecord, StockGuideInput, StockGuideItem, Supplier, StockTransfer } from '@/shared/types/domain.types';

export type GuideLineItem = StockGuideItem;
export type StockWorkspaceMode = 'direct' | 'transfer';
export type StockMovementType = 'entrada' | 'saida';
export type StockTypeFilter = 'ALL' | 'entrada' | 'saida';

export interface StockMovementsProps {
  movements: StockMovement[];
  articles: Article[];
  suppliers: Supplier[];
  documents?: DocumentRecord[];
  warehouses: AccessScope[];
  operatorName: string;
  onSaveGuide: (guide: StockGuideInput) => Promise<string>;
  onCancelGuide: (documentId: string, reason: string) => Promise<void>;
  onOpenDocument?: (doc: DocumentRecord) => void;
  canPostEntry: boolean;
  canPostExit: boolean;
  canAllowNegative: boolean;
  canViewCost?: boolean;
  canCancelGuide: boolean;
  canTransfer: boolean;
}
