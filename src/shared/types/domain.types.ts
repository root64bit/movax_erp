/**
 * MOVAX ERP / POS - Canonical Domain Types
 */

export interface Article {
  id: string;
  code: string;
  barcode?: string;
  description: string;
  unit: string;
  minStock: number;
  stock: number;
  costPrice: number;
  profitMargin: number;
  sellPrice: number;
  sellPriceWithIva: number;
  taxCodeId?: string;
  taxRate: number;
  category: string;
  brand?: string;
  size?: string;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  unitId?: string;
  soldQuantity?: number;
}

export interface SaleItem {
  documentLineId?: string;
  articleId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount?: number;
  ivaPercent: number;
  total: number;
  lineType?: 'STOCK' | 'SERVICE' | 'MANUAL';
  stockEffectEnabled?: boolean;
}

export interface SaleInvoice {
  id: string;
  clientId?: string;
  docNumber: string;
  date: string;
  clientName: string;
  clientNuit: string;
  clientAddress: string;
  paymentMethod: string;
  paymentReference?: string;
  paymentTermCode?: string;
  paymentMethodCode?: string;
  documentTypeCode?: string;
  sellerName: string;
  operatorName?: string;
  items: SaleItem[];
  subtotalBruto: number;
  descontoTotal: number;
  generalDiscountAmount?: number;
  subtotalLiquido?: number;
  ivaTotal: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'Concluída' | 'Pendente' | 'Cancelada';
  time?: string;
  notes?: string;
  clientPhone?: string;
  bankAccountBci?: string;
  bankNibBci?: string;
  bankAccountBim?: string;
  bankNibBim?: string;
  validityDays?: string;
  keepAsWalkIn?: boolean;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  productId?: string;
  type: 'entrada' | 'saida';
  docRef: string;
  sourceDocumentId?: string;
  docTypeCode?: string;
  docTypeName?: string;
  date: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  entityName: string;
  operator: string;
  warehouseId?: string;
  warehouseName?: string;
  reason?: string;
  notes?: string;
  unitCost?: number;
  sellPriceWithIva?: number;
  quantityIn?: number;
  quantityOut?: number;
  balanceAfter?: number;
}

export interface StockGuideItem {
  documentLineId?: string;
  articleId: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitCost?: number;
  salePriceWithIva?: number;
  currentStock: number;
  totalCost?: number;
}

export interface StockGuideInput {
  id?: string;
  type: 'entrada' | 'saida';
  guideNumber: string;
  date: string;
  warehouseId: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  items: StockGuideItem[];
}

export type StockTransferStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface StockTransferLine {
  id?: string;
  articleId: string;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitCost?: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  transferDate: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: StockTransferStatus;
  notes?: string;
  createdAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  lines: StockTransferLine[];
}

export interface AccessScope {
  id: string;
  code: string;
  name: string;
}

export interface RoleSummary {
  code: string;
  name: string;
}

export interface UserContext {
  userId: string;
  companyId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  roles: RoleSummary[];
  permissions: string[];
  branches: AccessScope[];
  warehouses: AccessScope[];
  activeBranch?: AccessScope;
  activeWarehouse?: AccessScope;
  activePosTerminal?: {
    id: string;
    code: string;
    name: string;
    seriesPrefix?: string;
  };
  systemMode: string;
}

export interface DashboardMetrics {
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  salesToday: number;
  receivables: number;
  debtorCount?: number;
  payables: number;
  draftDocuments: number;
  serverDate: string;
}

export interface ReferenceOption {
  id: string;
  code: string;
  name: string;
  requiresImmediatePayment?: boolean;
  requiresReference?: boolean;
  allowsCustomerReceipt?: boolean;
  allowsSupplierPayment?: boolean;
}

export interface Client {
  id: string;
  code?: string;
  number?: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  email: string;
  pendingBalance: number;
  active?: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  number: string;
  name: string;
  nuit: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  totalPurchases: number;
  pendingBalance: number;
  active?: boolean;
}

export interface BankAccount {
  bankName: string;
  account: string;
  nib: string;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  taxNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
  bankBciAccount?: string;
  bankBciNib?: string;
  bankBimAccount?: string;
  bankBimNib?: string;
  bankAccounts?: BankAccount[];
  quotationValidityDays?: string;
  quotationDefaultNotes?: string;
}

export interface DocumentRecord {
  id: string;
  displayNumber: string;
  date: string;
  dueDate: string;
  typeCode: string;
  typeName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyId: string;
  partyCode?: string;
  partyName: string;
  status: string;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  salespersonName?: string;
  notes?: string;
  sourceDocumentId?: string;
  createdAt?: string;
  items?: SaleItem[];
  warehouseId?: string;
  externalReference?: string;
  stockGuideItems?: StockGuideItem[];
}

export interface PaymentRecord {
  id: string;
  displayNumber: string;
  date: string;
  direction: 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT';
  partyName: string;
  totalAmount: number;
  allocatedAmount: number;
  unappliedAmount: number;
  status: string;
  reference?: string;
  description?: string;
}

export interface CashSession {
  id: string;
  branchId: string;
  warehouseId: string;
  posTerminalId?: string;
  openedBy: string;
  openedAt: string;
  openingAmount: number;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  declaredClosingAmount?: number;
  expectedClosingAmount?: number;
  varianceAmount?: number;
  closingNotes?: string;
}

export interface CashSessionMovement {
  id: string;
  cashSessionId: string;
  movementType: 'REINFORCEMENT' | 'WITHDRAWAL';
  amount: number;
  note?: string;
  createdAt: string;
}

export interface LedgerRecord {
  id: string;
  date: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyName: string;
  entryType: string;
  debitAmount: number;
  creditAmount: number;
  outstandingAmount: number;
  status: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  roles: string[];
  bundles?: string[];
  permissions?: string[];
  telephone?: string;
}

export interface PurchaseItem {
  articleId: string;
  code: string;
  description: string;
  quantity: number;
  unitCost: number;
  discountPercent: number;
  taxPercent: number;
  total: number;
}

export interface PurchaseInvoiceInput {
  supplierId: string;
  date: string;
  supplierInvoiceNumber: string;
  paymentTermCode: string;
  items: PurchaseItem[];
}

export interface PartyInput {
  number: string;
  name: string;
  taxNumber?: string;
  telephone?: string;
  email?: string;
  address?: string;
  city?: string;
  contactPerson?: string;
  creditLimit?: number;
  paymentTermCode?: string;
}

export type SubscriptionPlanCode = 'STARTER' | 'BUSINESS' | 'PRO' | 'ENTERPRISE';

export interface SubscriptionPlan {
  code: SubscriptionPlanCode;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxWarehouses: number | null;
  maxPosTerminals: number | null;
  includedFeatures: string[];
  features?: string[];
  popular?: boolean;
}

export interface CompanySubscription {
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  startsAt: string;
  expiresAt?: string;
  daysRemaining: number;
  currentPeriodEnd?: string;
}

export interface LicenseUsage {
  usersCount: number;
  branchesCount: number;
  warehousesCount: number;
  posTerminalsCount: number;
}

export interface CompanyAddonItem {
  id?: string;
  addonCode: string;
  name?: string;
  description?: string;
  priceMonthly?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
}

export interface LicenseBillingInvoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  planCode: string;
  amountMzn: number;
  paymentMethod: string;
  paymentReference?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string;
}

export interface LicenseOverview {
  plan: SubscriptionPlan;
  subscription: CompanySubscription;
  usage: LicenseUsage;
  addons: CompanyAddonItem[];
  invoices: LicenseBillingInvoice[];
}

export interface TenantOnboardingInput {
  companyName: string;
  taxNumber: string;
  city: string;
  address?: string;
  phone?: string;
  currency?: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword: string;
  planCode: SubscriptionPlanCode;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  paymentMethod: 'M_PESA' | 'BANK_TRANSFER';
  mpesaNumber?: string;
}

