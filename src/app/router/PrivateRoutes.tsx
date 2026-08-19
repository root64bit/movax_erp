import React, { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { PageLoader } from '@/shared/components/feedback';
import { PartyModal } from '@/components/PartyModal';
import { NewArticleModal } from '@/features/inventory/components/NewArticleModal';
import { PaymentModal } from '@/features/cash/components/PaymentModal';
import { PrintInvoiceModal } from '@/features/documents/components/PrintInvoiceModal';
import { PrintRecordModal } from '@/features/documents/components/PrintRecordModal';
import type {
  Article,
  CompanyProfile,
  DocumentRecord,
  LedgerRecord,
  PaymentRecord,
  SaleInvoice,
  StockMovement,
  UserSummary,
  UserContext,
  DashboardMetrics,
  ReferenceOption,
  PartyInput,
  Client,
  Supplier,
} from '@/shared/types/domain.types';
import {
  loadAppData,
  saveStockGuide,
  cancelFinancialAdvice,
  saveCompanyQuotationSettings,
  setOperationalContext,
  type AppDataScope,
} from '@/lib/appData';
import { AuthService } from '@/features/auth';
import { InventoryService } from '@/features/inventory';
import { SalesService } from '@/features/sales';
import { QuotationService } from '@/features/quotations';
import { PurchasesService } from '@/features/purchases';
import { DocumentsService } from '@/features/documents';
import { CashService } from '@/features/cash';
import { PartiesService } from '@/features/customers';
import { AdministrationService } from '@/features/administration';
import { StockTransfersService } from '@/features/stock-transfers';
import { useOperationalContext } from '@/shared/context/OperationalContext';

const Dashboard = lazy(() => import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('@/features/inventory/pages/InventoryPage').then((m) => ({ default: m.Inventory })));
const PosPage = lazy(() => import('@/features/pos/pages/PosPage').then((m) => ({ default: m.NewSale })));
const Quotation = lazy(() => import('@/features/quotations/pages/QuotationPage').then((m) => ({ default: m.Quotation })));
const StockMovements = lazy(() => import('@/features/stock-transfers/pages/StockMovementsPage').then((m) => ({ default: m.StockMovements })));
const Purchases = lazy(() => import('@/features/purchases/pages/PurchasesPage').then((m) => ({ default: m.Purchases })));
const Documents = lazy(() => import('@/features/documents/pages/DocumentsPage').then((m) => ({ default: m.Documents })));
const Accounts = lazy(() => import('@/features/cash/pages/AccountsPage').then((m) => ({ default: m.Accounts })));
const Entities = lazy(() => import('@/features/customers/pages/EntitiesPage').then((m) => ({ default: m.Entities })));
const Reports = lazy(() => import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.Reports })));
const Administration = lazy(() => import('@/features/administration/pages/AdministrationPage').then((m) => ({ default: m.Administration })));
const LicenseManagement = lazy(() => import('@/features/subscriptions/pages/LicenseManagementPage').then((m) => ({ default: m.LicenseManagementPage })));

export interface PrivateRoutesProps {
  userContext: UserContext | null;
  onRefreshData?: () => Promise<void>;
}

export const PrivateRoutes: React.FC<PrivateRoutesProps> = ({ userContext, onRefreshData }) => {
  const { hasPermission } = useOperationalContext();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const p = window.location.pathname.replace('/', '').trim();
    return p || 'dashboard';
  });

  const [globalSearch, setGlobalSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  // App domain states
  const [articles, setArticles] = useState<Article[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [ledgers, setLedgers] = useState<LedgerRecord[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<ReferenceOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ReferenceOption[]>([]);
  const [systemMode, setSystemMode] = useState('ONLINE');
  const [company, setCompany] = useState<CompanyProfile>({
    name: 'Movax ERP Tenant',
    taxNumber: '999999999',
    address: 'Maputo, Moçambique',
    city: 'Maputo',
    country: 'Moçambique',
    phone: '(+258) 84 000 0000',
    email: 'info@empresa.co.mz',
    currency: 'MZN',
  });

  // Modals state
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [partyModalType, setPartyModalType] = useState<'customer' | 'supplier' | null>(null);
  const [paymentModalDoc, setPaymentModalDoc] = useState<DocumentRecord | null>(null);
  const [printInvoice, setPrintInvoice] = useState<SaleInvoice | null>(null);
  const [printRecord, setPrintRecord] = useState<DocumentRecord | null>(null);

  const permissions = userContext?.permissions || [];
  const roles = userContext?.roles?.map((r) => (typeof r === 'string' ? r : r.code)) || [];

  const tabAccess: Record<string, string[]> = {
    dashboard: [],
    pos: ['sales.create', 'sales.view'],
    quotation: ['sales.create', 'sales.view'],
    inventory: ['products.view'],
    movements: ['stock.direct_entry', 'stock.direct_exit', 'stock.transfer'],
    purchases: ['purchases.view', 'purchases.invoice.create'],
    documents: ['documents.view'],
    accounts: ['cash_sessions.view', 'payments.create'],
    entities: ['customers.view', 'suppliers.view'],
    reports: ['reports.financial', 'reports.stock'],
    admin: ['settings.manage'],
    subscriptions: ['settings.manage'],
  };

  const applyAppData = useCallback((data: any) => {
    if (data.articles) setArticles(data.articles);
    if (data.clients) setClients(data.clients);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.sales) setSales(data.sales);
    if (data.documents) setDocuments(data.documents);
    if (data.movements) setMovements(data.movements);
    if (data.payments) setPayments(data.payments);
    if (data.ledgers) setLedgers(data.ledgers);
    if (data.users) setUsers(data.users);
    if (data.paymentTerms) setPaymentTerms(data.paymentTerms);
    if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
    if (data.company) setCompany(data.company);
    if (data.systemMode) setSystemMode(data.systemMode);
  }, []);

  const refreshData = useCallback(async (scope: AppDataScope = 'all') => {
    setDataLoading(true);
    try {
      const data = await loadAppData(scope);
      applyAppData(data);
    } catch (err) {
      console.error('Failed to load operational data', err);
    } finally {
      setDataLoading(false);
    }
  }, [applyAppData]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const changeTab = useCallback((nextTab: string) => {
    setActiveTab(nextTab);
    const targetPath = nextTab === 'dashboard' ? '/' : `/${nextTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  const hasAccess = useCallback((tab: string) => {
    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
    const required = tabAccess[tab];
    if (!required || required.length === 0) return true;
    return required.some((perm) => permissions.includes(perm));
  }, [permissions, roles]);

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={changeTab}
      globalSearch={globalSearch}
      setGlobalSearch={setGlobalSearch}
      userLabel={userContext?.fullName}
      roleLabel={roles.join(', ')}
      companyName={company.name}
      systemMode={systemMode}
      warehouseLabel={userContext?.activeWarehouse?.name}
      warehouses={userContext?.warehouses}
      activeWarehouseId={userContext?.activeWarehouse?.id}
      onSelectWarehouse={async (id) => {
        await setOperationalContext(id);
        await refreshData('all');
      }}
      onSignOut={() => void AuthService.signOut()}
      permissions={permissions}
      articles={articles}
      clients={clients}
      documents={documents}
    >
      <Suspense fallback={<PageLoader message="A carregar módulo..." />}>
        {activeTab === 'dashboard' && hasAccess('dashboard') && (
          <Dashboard
            articles={articles}
            sales={sales}
            clients={clients}
            documents={documents}
            movements={movements}
            suppliers={suppliers}
            serverDate={new Date().toISOString()}
            onNavigate={(tab: string) => changeTab(tab)}
            canViewCost={permissions.includes('reports.stock')}
            canAllowNegative={permissions.includes('stock.negative')}
            permissions={permissions}
          />
        )}

        {activeTab === 'pos' && hasAccess('pos') && (
          <PosPage
            articles={articles}
            clients={clients}
            sales={sales}
            onCompleteSale={async (sale) => {
              const res = await SalesService.createSaleInvoice(sale, sale.clientId || '1');
              await refreshData('sales');
              return res;
            }}
            onOpenPrintModal={(sale: any) => setPrintInvoice(sale)}
            operatorName={userContext?.fullName || 'Operador'}
            warehouses={userContext?.warehouses || []}
            warehouseId={userContext?.activeWarehouse?.id}
            paymentMethods={paymentMethods}
            paymentTerms={paymentTerms}
            canViewCost={permissions.includes('reports.stock')}
            canAllowNegative={permissions.includes('stock.negative')}
            permissions={permissions}
            canReceivePayment={permissions.includes('payments.create')}
          />
        )}

        {activeTab === 'quotation' && hasAccess('quotation') && (
          <Quotation
            articles={articles}
            clients={clients}
            sales={sales}
            documents={documents}
            onCreateQuotation={async (q) => {
              const res = await QuotationService.createQuotation(q, q.clientId || '1');
              await refreshData('sales');
              return res;
            }}
            onOpenPrintModal={(doc) => setPrintInvoice(doc)}
            operatorName={userContext?.fullName || 'Operador'}
            warehouseId={userContext?.activeWarehouse?.id}
            onUpdateDocument={async (id, payload) => {
              await DocumentsService.updateDocumentDetails(id, payload);
              await refreshData('documents');
            }}
          />
        )}

        {activeTab === 'inventory' && hasAccess('inventory') && (
          <Inventory
            articles={articles}
            movements={movements}
            sales={sales}
            documents={documents}
            canCreate={permissions.includes('products.create')}
            canEdit={permissions.includes('products.edit')}
            canDelete={permissions.includes('products.delete')}
            canViewCost={permissions.includes('reports.stock')}
            canAllowNegative={permissions.includes('stock.negative')}
            canAdjustStock={permissions.includes('stock.adjust')}
            warehouseId={userContext?.activeWarehouse?.id}
            onOpenNewModal={() => setIsArticleModalOpen(true)}
            onSaveArticle={async (art: any) => {
              await InventoryService.saveArticle(art);
              await refreshData('stock');
            }}
            onDeleteArticle={async (id: any) => {
              await refreshData('stock');
            }}
            onOpenDocument={(doc: any) => setPrintRecord(doc)}
          />
        )}

        {activeTab === 'movements' && hasAccess('movements') && (
          <StockMovements
            movements={movements}
            articles={articles}
            suppliers={suppliers}
            documents={documents}
            warehouses={userContext?.warehouses || []}
            operatorName={userContext?.fullName || 'Operador'}
            onSaveGuide={async (g) => {
              const res = await saveStockGuide(g);
              await refreshData('stock');
              return res;
            }}
            onCancelGuide={async (id, reason) => {
              await StockTransfersService.cancelStockGuide(id, reason);
              await refreshData('stock');
            }}
            onOpenDocument={(doc: any) => setPrintRecord(doc)}
            canPostEntry={permissions.includes('stock.direct_entry')}
            canPostExit={permissions.includes('stock.direct_exit')}
            canAllowNegative={permissions.includes('stock.negative')}
            canViewCost={permissions.includes('reports.stock')}
            canCancelGuide={permissions.includes('stock.cancel')}
            canTransfer={permissions.includes('stock.transfer') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')}
          />
        )}

        {activeTab === 'purchases' && hasAccess('purchases') && (
          <Purchases
            articles={articles}
            suppliers={suppliers}
            documents={documents}
            canCreate={permissions.includes('purchases.invoice.create')}
            canPay={permissions.includes('payments.create')}
            warehouseId={userContext?.activeWarehouse?.id}
            onCreateInvoice={async (inv) => {
              const doc = await PurchasesService.createSupplierInvoice(inv);
              await refreshData('documents');
              return doc;
            }}
            onPayInvoice={async (doc, method, amt, ref) => {
              await CashService.createSupplierPayment(doc, method, amt, ref);
              await refreshData('documents');
            }}
            onOpenNewSupplier={() => {
              setPartyModalType('supplier');
              setIsPartyModalOpen(true);
            }}
            onOpenDocument={(doc: any) => setPrintRecord(doc)}
            paymentTerms={paymentTerms}
            paymentMethods={paymentMethods}
          />
        )}

        {activeTab === 'documents' && hasAccess('documents') && (
          <Documents
            documents={documents}
            sales={sales}
            articles={articles}
            onPrint={(sale: any) => setPrintInvoice(sale)}
            onPrintRecord={(doc: any) => setPrintRecord(doc)}
            canCancelDocument={permissions.includes('documents.cancel')}
            onCancelDocument={async (id, reason) => {
              await SalesService.cancelDocument(id, reason);
              await refreshData('documents');
            }}
            canCancelAdvice={permissions.includes('documents.cancel')}
            onCancelAdvice={async (id, reason) => {
              await cancelFinancialAdvice(id, reason, crypto.randomUUID());
              await refreshData('documents');
            }}
            onUpdateDocument={async (id, payload) => {
              await DocumentsService.updateDocumentDetails(id, payload);
              await refreshData('documents');
            }}
            permissions={permissions}
          />
        )}

        {activeTab === 'accounts' && hasAccess('accounts') && (
          <Accounts
            clients={clients}
            suppliers={suppliers}
            documents={documents}
            payments={payments}
            ledgers={ledgers}
            paymentMethods={paymentMethods}
            canManageCash={permissions.includes('cash_sessions.manage')}
            canRegisterPayment={permissions.includes('payments.create')}
            onOpenReceiptModal={(doc: any) => setPaymentModalDoc(doc)}
            onPrintRecord={(doc: any) => setPrintRecord(doc)}
            onDirectPayment={async (partyType: 'CUSTOMER' | 'SUPPLIER', partyId: string, method: string, amt: number, desc?: string) => {
              if (partyType === 'CUSTOMER') {
                const targetDoc = documents.find((d) => d.partyId === partyId) || sales.find((s) => s.clientId === partyId);
                if (targetDoc) {
                  await CashService.createCustomerPayment(targetDoc, method, amt, desc || '');
                }
              }
              await refreshData('documents');
            }}
          />
        )}

        {activeTab === 'entities' && hasAccess('entities') && (
          <Entities
            clients={clients}
            suppliers={suppliers}
            canCreate={permissions.includes('customers.create') || permissions.includes('suppliers.create')}
            canEdit={permissions.includes('customers.edit') || permissions.includes('suppliers.edit')}
            canDelete={permissions.includes('customers.delete') || permissions.includes('suppliers.delete')}
            onOpenModal={(type: 'customer' | 'supplier') => {
              setPartyModalType(type);
              setIsPartyModalOpen(true);
            }}
            onUpdateParty={async (type: 'customer' | 'supplier', id: string, input: PartyInput) => {
              await PartiesService.updateParty(type, id, input);
              await refreshData('entities');
            }}
            onDeleteParty={async (type: 'customer' | 'supplier', id: string) => {
              await refreshData('entities');
            }}
          />
        )}

        {activeTab === 'reports' && hasAccess('reports') && (
          <Reports
            articles={articles}
            documents={documents}
            movements={movements}
            sales={sales}
            clients={clients}
            suppliers={suppliers}
            canViewFinancial={permissions.includes('reports.financial')}
            canViewStock={permissions.includes('reports.stock')}
            canViewCost={permissions.includes('reports.stock')}
            permissions={permissions}
            onPrintRecord={(doc: any) => setPrintRecord(doc)}
          />
        )}

        {activeTab === 'subscriptions' && hasAccess('subscriptions') && (
          <LicenseManagement />
        )}

        {activeTab === 'admin' && hasAccess('admin') && (
          <Administration
            systemMode={systemMode}
            users={users}
            permissions={permissions}
            company={company}
            onUpdateUser={async (user, active, bundles, extraPerms, newPass) => {
              await AdministrationService.updateUser(user, active, bundles, extraPerms, newPass);
              await refreshData('users');
            }}
            onCreateUser={async (userData) => {
              await AdministrationService.createUser(userData);
              await refreshData('users');
            }}
            onSaveCompanySettings={async (settings) => {
              await saveCompanyQuotationSettings(company.id || 'default-company', settings as any);
              await refreshData('all');
            }}
          />
        )}
      </Suspense>

      {/* Shared Modals */}
      {isPartyModalOpen && (
        <PartyModal
          type={partyModalType}
          onClose={() => {
            setIsPartyModalOpen(false);
            setPartyModalType(null);
          }}
          onSave={async (type, input) => {
            if (type === 'customer') await PartiesService.createCustomer(input);
            else if (type === 'supplier') await PartiesService.createSupplier(input);
            await refreshData('entities');
          }}
          paymentTerms={paymentTerms}
        />
      )}

      {isArticleModalOpen && (
        <NewArticleModal
          isOpen={isArticleModalOpen}
          onClose={() => setIsArticleModalOpen(false)}
          onSave={async (art: any) => {
            await InventoryService.saveArticle(art);
            await refreshData('stock');
            setIsArticleModalOpen(false);
          }}
          existingArticles={articles}
        />
      )}

      {paymentModalDoc && (
        <PaymentModal
          isOpen={Boolean(paymentModalDoc)}
          onClose={() => setPaymentModalDoc(null)}
          document={paymentModalDoc}
          paymentMethods={paymentMethods}
          onConfirmPayment={async (methodCode: string, paidAmount: number, ref: string) => {
            if (!paymentModalDoc) return;
            await CashService.createCustomerPayment(paymentModalDoc, methodCode, paidAmount, ref);
            await refreshData('documents');
            setPaymentModalDoc(null);
          }}
        />
      )}

      <PrintInvoiceModal
        isOpen={Boolean(printInvoice)}
        onClose={() => setPrintInvoice(null)}
        invoice={printInvoice}
        company={company}
      />

      <PrintRecordModal
        isOpen={Boolean(printRecord)}
        onClose={() => setPrintRecord(null)}
        document={printRecord}
        payment={null}
        company={company}
      />
    </Layout>
  );
};
