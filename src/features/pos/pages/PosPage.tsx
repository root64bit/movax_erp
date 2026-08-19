import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Article, SaleInvoice, SaleItem, Client, ReferenceOption, DocumentRecord } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { ArticleSearchSelect } from '@/features/inventory/components/ArticleSearchSelect';
import { calculateDocumentLine, calculateDocumentTotals, recalculateSaleItem, recalculateSaleItems } from '@/lib/documentCalculations';
import { SaleBalanceSummary } from '../components/SaleBalanceSummary';
import { SaleTotalsSection } from '../components/SaleTotalsSection';
import { SaleDocumentHistory } from '../components/SaleDocumentHistory';
import { InventoryService } from '@/features/inventory/services/inventory.service';

const normalizeClientSearch = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('pt-PT');

const isWalkInClient = (client: Client): boolean => {
  const code = String(client.number || client.code || '').trim();
  const name = normalizeClientSearch(client.name);
  // Code 1 is reserved for Cliente Pontual.
  return code === '1' || name.includes('pontual') || name.includes('cliente final');
};

interface NewSaleProps {
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
  warehouses?: import('@/shared/types/domain.types').AccessScope[];
  canViewCost?: boolean;
  canAllowNegative?: boolean;
  onUpdateDocument?: (documentId: string, payload: { documentDate?: string; clientName?: string; clientNuit?: string; clientAddress?: string; grandTotal?: number; notes?: string; items?: SaleItem[]; generalDiscount?: number; keepAsWalkIn?: boolean }) => Promise<void>;
}

export const NewSale: React.FC<NewSaleProps> = ({
  articles,
  clients,
  sales = [],
  onCompleteSale,
  onOpenPrintModal,
  canReceivePayment,
  operatorName,
  paymentTerms,
  paymentMethods,
  documents,
  permissions = [],
  warehouseId,
  warehouses = [],
  onUpdateDocument,
}) => {
  const findArticle = (id: string) => articles.find((a) => a.id === id);
  const isGuiaOnlyUser = permissions.length > 0 && !permissions.includes('settings.manage') && !permissions.includes('products.view');

  const [documentType, setDocumentType] = useState<'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE'>(
    isGuiaOnlyUser ? 'CUSTOMER_DELIVERY_NOTE' : 'CUSTOMER_INVOICE'
  );

  useEffect(() => {
    if (isGuiaOnlyUser && documentType !== 'CUSTOMER_DELIVERY_NOTE') {
      setDocumentType('CUSTOMER_DELIVERY_NOTE');
    }
  }, [isGuiaOnlyUser, documentType]);

  const issuedGuias = useMemo(() => {
    return (sales || []).filter((s) => {
      const isSaleDocument = ['CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_DELIVERY_NOTE'].includes(s.documentTypeCode || '');
      if (!isSaleDocument || s.status === 'Cancelada') return false;
      if (isGuiaOnlyUser) {
        return s.documentTypeCode === 'CUSTOMER_DELIVERY_NOTE' || s.docNumber?.startsWith('GR');
      }
      return isSaleDocument;
    });
  }, [sales, isGuiaOnlyUser]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [docNumber, setDocNumber] = useState('A atribuir ao confirmar');
  const [docStatus, setDocStatus] = useState<'PREPARATION' | 'CONFIRMING' | 'CONFIRMED' | 'READ_ONLY'>('PREPARATION');
  const savingRef = useRef(false);

  const [clientCodeInput, setClientCodeInput] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [keepAsWalkIn, setKeepAsWalkIn] = useState(false);
  const [showClientInvoices, setShowClientInvoices] = useState(false);
  const [showClientNameMatches, setShowClientNameMatches] = useState(false);

  const immediateTerm = paymentTerms.find((item) => item.requiresImmediatePayment);
  const creditTerm = paymentTerms.find((item) => !item.requiresImmediatePayment);
  const receiptMethod = paymentMethods.find((item) => item.allowsCustomerReceipt);
  const defaultCashMethod = paymentMethods.find((item) => item.code === 'CASH') ?? receiptMethod;
  const [paymentSelection, setPaymentSelection] = useState(
    `TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`
  );
  const [paymentReference, setPaymentReference] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [catalogCache, setCatalogCache] = useState<Record<string, Article>>({});
  const [customDescription, setCustomDescription] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const [inputIva, setInputIva] = useState<number>(articles[0]?.taxRate ?? 16);
  const [inputUnitPrice, setInputUnitPrice] = useState<number>(0);

  const [generalDiscount, setGeneralDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmedSaleRecord, setConfirmedSaleRecord] = useState<SaleInvoice | null>(null);

  // Edit Modal State for History
  const [editingSale, setEditingSale] = useState<SaleInvoice | null>(null);
  const [editDocumentDate, setEditDocumentDate] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientNuit, setEditClientNuit] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editGrandTotal, setEditGrandTotal] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editGeneralDiscount, setEditGeneralDiscount] = useState(0);
  const [editKeepAsWalkIn, setEditKeepAsWalkIn] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Auto-sync editGrandTotal when editItems changes
  useEffect(() => {
    if (editingSale) {
      setEditGrandTotal(calculateDocumentTotals(editItems, editGeneralDiscount).grandTotal);
    }
  }, [editItems, editGeneralDiscount, editingSale]);

  const handleOpenEditSale = (doc: SaleInvoice) => {
    setEditingSale(doc);
    setEditDocumentDate((doc.date || new Date().toISOString()).slice(0, 10));
    setEditClientName(doc.clientName || '');
    setEditClientNuit(doc.clientNuit || '');
    setEditClientAddress(doc.clientAddress || '');
    setEditGrandTotal(doc.totalAmount || 0);
    setEditNotes(doc.notes || '');
    const lineDiscount = (doc.items || []).reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    setEditGeneralDiscount(doc.generalDiscountAmount ?? Math.max(0, (doc.descontoTotal || 0) - lineDiscount));
    setEditKeepAsWalkIn(false);
    
    let loadedItems: SaleItem[] = doc.items && doc.items.length > 0 ? JSON.parse(JSON.stringify(doc.items)) : [];
    if (loadedItems.length === 0 && (doc.totalAmount || 0) > 0) {
      loadedItems = [{
        articleId: `custom-${Date.now()}`,
        code: 'DIV',
        description: 'Artigo / Serviço Geral',
        quantity: 1,
        unitPrice: doc.totalAmount,
        discountPercent: 0,
        discountAmount: 0,
        ivaPercent: 16,
        total: doc.totalAmount,
        lineType: 'MANUAL',
        stockEffectEnabled: false,
      }];
    }
    setEditItems(recalculateSaleItems(loadedItems));
    setEditError('');
  };

  const handleExecuteSaveEditSale = async () => {
    if (!editingSale || !onUpdateDocument || isSavingEdit) return;
    if (editItems.length === 0) {
      setEditError('O documento deve manter pelo menos um artigo ou serviço.');
      return;
    }
    try {
      setIsSavingEdit(true);
      setEditError('');
      await onUpdateDocument(editingSale.id, {
        documentDate: editDocumentDate,
        clientName: editClientName.trim(),
        clientNuit: editClientNuit.trim(),
        clientAddress: editClientAddress.trim(),
        grandTotal: Number(editGrandTotal),
        notes: editNotes.trim(),
        items: recalculateSaleItems(editItems),
        generalDiscount: editGeneralDiscount,
        keepAsWalkIn: editKeepAsWalkIn,
      });
      setEditingSale(null);
    } catch (err: any) {
      setEditError(err?.message || 'Falha ao guardar alterações do documento.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const customDescriptionInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const clientCodeInputRef = useRef<HTMLInputElement>(null);
  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const clientNuitInputRef = useRef<HTMLInputElement>(null);
  const clientAddressInputRef = useRef<HTMLInputElement>(null);
  const paymentSelectionRef = useRef<HTMLSelectElement>(null);
  const deliveryLocationRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const ivaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clients.length === 0 || selectedClientId) return;
    const pontual = clients.find(
      (client) => client.number === '1' || client.code === '1' || client.name.toLowerCase().includes('pontual')
    ) || clients[0];
    setSelectedClientId(pontual.id);
    setSelectedClientName(pontual.number === '1' || pontual.code === '1' ? 'Cliente Pontual' : pontual.name);
    setClientCodeInput(pontual.number || pontual.code || '1');
  }, [clients, selectedClientId]);

  const clientNameMatches = useMemo(() => {
    const query = normalizeClientSearch(selectedClientName);
    if (!query || ['cliente pontual', 'cliente final', 'pontual'].includes(query)) return [];

    return clients
      .filter((client) => client.active !== false && !isWalkInClient(client))
      .filter((client) => normalizeClientSearch(client.name).includes(query))
      .sort((a, b) => {
        const aName = normalizeClientSearch(a.name);
        const bName = normalizeClientSearch(b.name);
        const aRank = aName === query ? 0 : aName.startsWith(query) ? 1 : 2;
        const bRank = bName === query ? 0 : bName.startsWith(query) ? 1 : 2;
        return aRank - bRank || aName.localeCompare(bName, 'pt-PT');
      })
      .slice(0, 8);
  }, [clients, selectedClientName]);

  const applySelectedClient = (client: Client) => {
    setSelectedClientId(client.id);
    setSelectedClientName(client.name);
    setClientNuit(client.nuit || '');
    setClientAddress(client.address || '');
    setClientCodeInput(client.number || client.code || '');
    setKeepAsWalkIn(false);
    setShowClientNameMatches(false);
    setShowClientInvoices(Boolean(documents?.some((document) => document.partyId === client.id && document.outstandingAmount > 0)));
  };

  const keepManualClientDetailsUnlinked = (clearCopiedDetails = false) => {
    const walkIn = clients.find(isWalkInClient);
    setSelectedClientId(walkIn?.id || 'client-pontual');
    setClientCodeInput('1');
    if (clearCopiedDetails) {
      setClientNuit('');
      setClientAddress('');
    }
    setShowClientInvoices(false);
  };

  const handleClientNameChange = (value: string) => {
    setSelectedClientName(value);

    const normalizedValue = normalizeClientSearch(value);
    const exactClient = clients.find(
      (client) => client.active !== false
        && !isWalkInClient(client)
        && normalizeClientSearch(client.name) === normalizedValue,
    );

    // A one-letter client name must not hide the autocomplete list. In this
    // database there is a client named "a"; choosing it while the operator has
    // only typed "A" prevents names such as AUTO COMPANY or AUGUSTO appearing.
    // Full names continue to link automatically, while Enter/click can select
    // any suggestion at any point.
    if (exactClient && normalizedValue.length > 1) {
      applySelectedClient(exactClient);
      return;
    }

    // The previously selected client must never receive a document after its
    // name has been changed to a different value. A new name remains eligible
    // for the existing automatic customer-creation logic when the document is saved.
    const previouslySelectedClient = clients.find((client) => client.id === selectedClientId);
    keepManualClientDetailsUnlinked(Boolean(previouslySelectedClient && !isWalkInClient(previouslySelectedClient)));
    setShowClientNameMatches(Boolean(normalizedValue));
  };

  const confirmResetIfNeeded = (): boolean => {
    if (items.length > 0 && docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY') {
      return window.confirm('Existem artigos/alterações não gravadas. Deseja descartar?');
    }
    return true;
  };

  const handleSelectDocumentType = (type: 'CUSTOMER_INVOICE' | 'CASH_SALE' | 'CUSTOMER_DELIVERY_NOTE') => {
    if (isGuiaOnlyUser && type !== 'CUSTOMER_DELIVERY_NOTE') {
      setSaveError('Acesso Restrito: O Operador de Caixa apenas pode emitir Guia de Remessa.');
      return;
    }

    if (!confirmResetIfNeeded()) return;

    setDocumentType(type);
    setDocStatus('PREPARATION');
    setItems([]);
    setConfirmedSaleRecord(null);
    setSaveError('');

    const pontualInDb = clients.find(
      (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual') || c.name.toLowerCase().includes('final')
    ) || clients[0];

    setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
    setSelectedClientName('Cliente Pontual');
    setClientCodeInput('1');
    setClientNuit('');
    setClientAddress('');
    setKeepAsWalkIn(false);
    setPaymentReference('');
    if (type === 'CASH_SALE' && defaultCashMethod) setPaymentSelection(`METHOD:${defaultCashMethod.code}`);
    else if (type === 'CUSTOMER_INVOICE') setPaymentSelection(`TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`);
  };

  const lookupClientByCode = (query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      const hasDetails = selectedClientName.trim() !== ''
        && !['cliente pontual', 'cliente final'].includes(selectedClientName.trim().toLowerCase());
      if (!hasDetails && !clientNuit.trim() && !clientAddress.trim()) {
        lookupClientByCode('1');
      }
      return;
    }

    // Code 1 is ALWAYS reserved for Cliente Pontual; accepting 01 here makes
    // manual entry friendlier without assigning it to another customer.
    if (clean === '1' || clean === '01') {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual') || c.name.toLowerCase().includes('final')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
      setKeepAsWalkIn(false);
      setShowClientInvoices(false);
      return;
    }

    const found = clients.find(
      (c) =>
        c.number !== '1' &&
        c.code !== '1' &&
        ((c.number && c.number.trim().toLowerCase() === clean) ||
          (c.code && c.code.trim().toLowerCase() === clean) ||
          c.id.toLowerCase() === clean ||
          String(c.number) === clean ||
          c.name.toLowerCase().includes(clean))
    );

    if (found) {
      applySelectedClient(found);
    } else {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      if (!selectedClientName || selectedClientName === 'Cliente Pontual') {
        setSelectedClientName('Cliente Pontual');
      }
      setShowClientInvoices(false);
      setShowClientNameMatches(false);
    }
  };

  const getArticlePriceWithIva = (art: Article): number => {
    if (art.sellPriceWithIva && art.sellPriceWithIva > 0) {
      return art.sellPriceWithIva;
    }
    if (art.sellPrice && art.sellPrice > 0) {
      return Math.round(art.sellPrice * (1 + (art.taxRate ?? 16) / 100) * 100) / 100;
    }
    return 0;
  };

  const articleSearchLoader = useMemo(
    () => (query: string) => InventoryService.searchProducts(query, warehouseId, 50),
    [warehouseId],
  );

  const resolveArticle = (art: Article) => {
    setCatalogCache((current) => current[art.id] === art ? current : { ...current, [art.id]: art });
    setCustomDescription(art.description);
    setInputIva(art.taxRate ?? 16);
    setInputUnitPrice(getArticlePriceWithIva(art));
  };

  const appendArticleToEdit = (art: Article) => {
    setCatalogCache((current) => current[art.id] === art ? current : { ...current, [art.id]: art });
    const priceWithIva = getArticlePriceWithIva(art);
    setEditItems((previous) => {
      const updated = [
        ...previous,
        {
          articleId: art.id,
          code: art.code,
          description: art.description,
          quantity: 1,
          unitPrice: priceWithIva,
          discountPercent: 0,
          discountAmount: 0,
          ivaPercent: art.taxRate ?? 16,
          total: priceWithIva,
          lineType: 'STOCK' as const,
          stockEffectEnabled: true,
        },
      ];
      setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
      return updated;
    });
  };

  const handleArticleSelect = (id: string) => {
    setSelectedArticleId(id);
    const art = findArticle(id);
    if (art) {
      setCustomDescription(art.description);
      setInputIva(art.taxRate ?? 16);
      setInputUnitPrice(getArticlePriceWithIva(art));
    }
  };

  const handleAfterArticleSelect = () => {
    setTimeout(() => {
      if (customDescriptionInputRef.current) {
        customDescriptionInputRef.current.focus();
        customDescriptionInputRef.current.select();
      } else if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 40);
  };

  const handleAddItem = () => {
    if (docStatus === 'CONFIRMING') return;

    const art = findArticle(selectedArticleId);
    const finalDesc = customDescription.trim() || art?.description || '';
    if (!finalDesc || inputQty <= 0) return;

    const priceWithIva = inputUnitPrice > 0 ? inputUnitPrice : (art ? getArticlePriceWithIva(art) : 0);
    const newItem = recalculateSaleItem({
      articleId: art?.id || `custom-${Date.now()}`,
      code: art?.code || 'DIV',
      description: finalDesc,
      quantity: inputQty,
      unitPrice: Math.round(priceWithIva * 100) / 100,
      discountPercent: 0,
      discountAmount: Math.max(0, inputDiscount),
      ivaPercent: inputIva,
      total: 0,
      lineType: art ? 'STOCK' : 'SERVICE',
      stockEffectEnabled: Boolean(art),
    });

    setItems((current) => [...current, newItem]);
    setInputQty(1);
    setInputDiscount(0);
    setSelectedArticleId('');
    setCustomDescription('');
    setInputUnitPrice(0);

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar catálogo"]');
      if (searchInput) {
        searchInput.focus();
      }
    }, 40);
  };

  const handleRemoveItem = (index: number) => {
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const totals = calculateDocumentTotals(items, generalDiscount);
  const descontoGeralValor = totals.generalDiscount;
  const subtotalBruto = totals.grossTotal;
  const descontoLinhas = totals.lineDiscountTotal;
  const subtotalLiquido = totals.netTotal;
  const ivaTotal = totals.taxTotal;
  const totalFinalAmount = totals.grandTotal;

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const previousBalance = selectedClient?.pendingBalance ?? 0;
  const selectedPaymentTerm = paymentTerms.find((term) => paymentSelection === `TERM:${term.code}`);
  const selectedPaymentMethod = paymentMethods.find((method) => paymentSelection === `METHOD:${method.code}`)
    ?? defaultCashMethod;
  const invoiceCreatesDebt = documentType === 'CUSTOMER_INVOICE' && !selectedPaymentTerm?.requiresImmediatePayment;
  const newAccumulatedBalance = previousBalance + (invoiceCreatesDebt ? totalFinalAmount : 0);

  const handleSaveAndConfirm = async (shouldPrint: boolean = false) => {
    if (savingRef.current) return;
    if (items.length === 0) {
      setSaveError('Adicione pelo menos 1 artigo ao documento.');
      return;
    }
    if (!selectedClientId) {
      setSaveError('Selecione um cliente válido.');
      return;
    }
    const requiresSettlement = documentType === 'CASH_SALE'
      || (documentType === 'CUSTOMER_INVOICE' && Boolean(selectedPaymentTerm?.requiresImmediatePayment));
    if (requiresSettlement && selectedPaymentMethod?.requiresReference && !paymentReference.trim()) {
      setSaveError(`O método ${selectedPaymentMethod.name} exige uma referência da transacção.`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const newSale: SaleInvoice = {
        id: `sale-${Date.now()}`,
        clientId: selectedClientId,
        documentTypeCode: documentType,
        docNumber: 'A atribuir ao confirmar',
        date,
        clientName: selectedClientName,
        clientNuit,
        clientAddress,
        paymentMethod:
          paymentSelection.startsWith('METHOD:')
            ? paymentSelection.replace('METHOD:', '')
            : defaultCashMethod?.code ?? 'CASH',
        paymentReference: paymentReference.trim() || undefined,
        paymentTermCode: paymentSelection.startsWith('TERM:')
          ? paymentSelection.replace('TERM:', '')
          : undefined,
        sellerName: operatorName,
        items: totals.lines,
        subtotalBruto,
        descontoTotal: descontoLinhas + descontoGeralValor,
        subtotalLiquido,
        ivaTotal,
        totalAmount: totalFinalAmount,
        paidAmount: documentType === 'CASH_SALE' || (documentType === 'CUSTOMER_INVOICE' && selectedPaymentTerm?.requiresImmediatePayment) ? totalFinalAmount : 0,
        pendingAmount: documentType === 'CASH_SALE' || documentType === 'CUSTOMER_DELIVERY_NOTE' || selectedPaymentTerm?.requiresImmediatePayment ? 0 : totalFinalAmount,
        status: 'Concluída',
        notes,
        keepAsWalkIn,
      };

      const savedSale = await onCompleteSale(newSale);
      setDocNumber(savedSale.docNumber || 'CONFIRMADO');
      setConfirmedSaleRecord(savedSale);
      setDocStatus('CONFIRMED');

      if (shouldPrint) {
        onOpenPrintModal(savedSale);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Falha ao confirmar o documento.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    if (!confirmResetIfNeeded()) return;

    setItems([]);
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao confirmar');
    setSaveError('');
    setConfirmedSaleRecord(null);
    setGeneralDiscount(0);
    setNotes('');
    setKeepAsWalkIn(false);

    const pontual = clients.find((client) => client.number === '1' || client.code === '1' || client.name.toLowerCase().includes('pontual')) || clients[0];
    if (pontual) {
      setSelectedClientId(pontual.id);
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    }
    setClientNuit('');
    setClientAddress('');
    setDeliveryLocation('');
    setPaymentReference('');
    if (documentType === 'CASH_SALE' && defaultCashMethod) setPaymentSelection(`METHOD:${defaultCashMethod.code}`);
    else setPaymentSelection(`TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`);

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Ex: 5"]')?.focus();
    }, 50);
  };

  const isOperationalFormEmpty = () => {
    const normalizedName = selectedClientName.trim().toLowerCase();
    const isDefaultCustomer = !normalizedName || normalizedName === 'cliente pontual' || normalizedName === 'cliente final';
    const normalizedCode = clientCodeInput.trim();
    return items.length === 0
      && !selectedArticleId
      && !customDescription.trim()
      && inputUnitPrice === 0
      && inputDiscount === 0
      && generalDiscount === 0
      && !notes.trim()
      && !clientNuit.trim()
      && !clientAddress.trim()
      && !deliveryLocation.trim()
      && !paymentReference.trim()
      && isDefaultCustomer
      && (!normalizedCode || normalizedCode === '1' || normalizedCode === '01');
  };

  const handleLoadLastDocument = () => {
    const lastDocument = sales.find((sale) =>
      ['CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_DELIVERY_NOTE'].includes(sale.documentTypeCode || '')
      && sale.status !== 'Cancelada'
    );

    if (!lastDocument) {
      setSaveError('Ainda não existe uma factura, VD ou guia emitida para consultar.');
      return;
    }

    const recoveredType = (lastDocument.documentTypeCode || 'CUSTOMER_INVOICE') as typeof documentType;
    setDocumentType(recoveredType);
    setDate(lastDocument.date || new Date().toISOString().split('T')[0]);
    setDocNumber(lastDocument.docNumber || 'Documento emitido');
    setSelectedClientId(lastDocument.clientId || '');
    setSelectedClientName(lastDocument.clientName || 'Cliente Pontual');
    setClientCodeInput(clients.find((client) => client.id === lastDocument.clientId)?.number || '1');
    setClientNuit(lastDocument.clientNuit || '');
    setClientAddress(lastDocument.clientAddress || '');
    setItems(recalculateSaleItems(lastDocument.items || []));
    setGeneralDiscount(lastDocument.generalDiscountAmount || 0);
    setNotes(lastDocument.notes || '');
    setConfirmedSaleRecord(lastDocument);
    setDocStatus('READ_ONLY');
    setSaveError('Último documento emitido carregado em modo de consulta. Prima F5 para criar um novo.');
  };

  const handleF2Action = () => {
    if (savingRef.current) return;
    if (docStatus === 'CONFIRMING') {
      void handleSaveAndConfirm(false);
      return;
    }
    if (docStatus !== 'PREPARATION') return;
    if (isOperationalFormEmpty()) {
      handleLoadLastDocument();
    } else if (items.length > 0) {
      setDocNumber('A atribuir ao confirmar');
      void handleSaveAndConfirm(false);
    } else {
      setDocNumber('A atribuir ao confirmar');
      setSaveError('Adicione pelo menos 1 artigo para emitir o documento. Os restantes campos são opcionais.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleF2Action();
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (docStatus === 'CONFIRMING') {
          setDocStatus('PREPARATION');
        } else if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
          setSaveError('Documento já confirmado/leitura. Alterações directas bloqueadas.');
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleResetForm();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if ((docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord) {
          onOpenPrintModal(confirmedSaleRecord);
        } else {
          setSaveError('Confirme primeiro o documento com F2 antes de imprimir (F9).');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (docStatus === 'CONFIRMING') {
          setDocStatus('PREPARATION');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docStatus, items, selectedClientId, totalFinalAmount, clients, documents, documentType, confirmedSaleRecord, sales, selectedClientName, clientCodeInput, clientNuit, clientAddress, deliveryLocation, selectedArticleId, customDescription, inputUnitPrice, inputDiscount, generalDiscount, notes, date, paymentSelection, paymentReference, keepAsWalkIn, operatorName, paymentTerms, saving, onCompleteSale, onOpenPrintModal]);

  return (
    <div className="space-y-4 pb-12 font-sans">
      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={isGuiaOnlyUser}
            onClick={() => handleSelectDocumentType('CUSTOMER_INVOICE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              isGuiaOnlyUser
                ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
                : documentType === 'CUSTOMER_INVOICE'
                  ? 'bg-[#003366] text-white shadow-md'
                  : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
            title={isGuiaOnlyUser ? 'Apenas o Administrador pode emitir Faturas' : ''}
          >
            Factura
          </button>
          <button
            type="button"
            disabled={isGuiaOnlyUser}
            onClick={() => handleSelectDocumentType('CASH_SALE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              isGuiaOnlyUser
                ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-400'
                : documentType === 'CASH_SALE'
                  ? 'bg-[#006e25] text-white shadow-md'
                  : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
            title={isGuiaOnlyUser ? 'Apenas o Administrador pode emitir Vendas a Dinheiro' : ''}
          >
            Venda a Dinheiro
          </button>
          <button
            type="button"
            onClick={() => handleSelectDocumentType('CUSTOMER_DELIVERY_NOTE')}
            className={`px-4 py-2 rounded-md font-extrabold text-xs uppercase transition-all ${
              documentType === 'CUSTOMER_DELIVERY_NOTE'
                ? 'bg-[#001e40] text-white shadow-md'
                : 'bg-[#f3f4f5] dark:bg-[#282c2e] text-[#737780] hover:text-[#191c1d] dark:hover:text-white'
            }`}
          >
            Guia de Remessa
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="text-right">
            <span className="text-[#737780] block text-[10px] uppercase font-bold">Nº Documento</span>
            <span className="font-bold text-sm text-[#003366] dark:text-[#a7c8ff]">{docNumber}</span>
          </div>
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <span
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold uppercase ${
              docStatus === 'CONFIRMED'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : docStatus === 'READ_ONLY'
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : docStatus === 'CONFIRMING'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {docStatus === 'CONFIRMED'
              ? 'CONFIRMADO'
              : docStatus === 'READ_ONLY'
              ? 'EM CONSULTA (LEITURA)'
              : docStatus === 'CONFIRMING'
              ? 'A CONFIRMAR'
              : 'EM PREPARAÇÃO'}
          </span>
          <button
            type="button"
            onClick={handleResetForm}
            className="rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            F5 — Novo
          </button>
        </div>
      </section>



      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] p-3 print:p-2 rounded-lg shadow-sm print:shadow-none space-y-2 print:space-y-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs print:text-[10px]">
          {/* Left Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Data Emissão</label>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientCodeInputRef.current?.focus();
                      clientCodeInputRef.current?.select();
                    }
                  }}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Código Cliente</label>
                <input
                  ref={clientCodeInputRef}
                  type="text"
                  placeholder="Ex: 5"
                  value={clientCodeInput}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lookupClientByCode(clientCodeInput);
                      setTimeout(() => {
                        clientNameInputRef.current?.focus();
                        clientNameInputRef.current?.select();
                      }, 0);
                    }
                  }}
                  onBlur={() => lookupClientByCode(clientCodeInput)}
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-bold disabled:opacity-60"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Nome do Cliente</label>
              <input
                ref={clientNameInputRef}
                type="text"
                value={selectedClientName}
                disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                onChange={(e) => handleClientNameChange(e.target.value)}
                onFocus={() => {
                  if (clientNameMatches.length > 0) setShowClientNameMatches(true);
                }}
                onBlur={() => window.setTimeout(() => setShowClientNameMatches(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (clientNameMatches.length > 0) applySelectedClient(clientNameMatches[0]);
                    clientNuitInputRef.current?.focus();
                    clientNuitInputRef.current?.select();
                  } else if (e.key === 'Escape') {
                    setShowClientNameMatches(false);
                  }
                }}
                placeholder="Nome do Cliente"
                className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-bold border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
              />
              {showClientNameMatches && clientNameMatches.length > 0 && docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
                <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded border border-[#9aa5b5] bg-white shadow-lg dark:border-[#59606a] dark:bg-[#282c2e] print:hidden">
                  <div className="border-b border-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-300">
                    Clientes encontrados — Enter seleciona o primeiro
                  </div>
                  {clientNameMatches.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySelectedClient(client)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-2 py-2 text-left text-xs hover:bg-blue-50 last:border-b-0 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <span className="font-bold text-[#003366] dark:text-[#a7c8ff]">{client.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        Cód. {client.number || client.code || '—'}{client.nuit ? ` · NUIT ${client.nuit}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <label className="mt-1 flex items-center gap-1.5 text-[10px] text-[#43474f] dark:text-[#c3c6d1] print:hidden">
                <input
                  type="checkbox"
                  checked={keepAsWalkIn}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setKeepAsWalkIn(e.target.checked)}
                />
                Manter como Cliente Pontual (não criar ficha; guardar os dados apenas neste documento)
              </label>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">NUIT</label>
                <input
                  ref={clientNuitInputRef}
                  type="text"
                  value={clientNuit}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientNuit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      clientAddressInputRef.current?.focus();
                      clientAddressInputRef.current?.select();
                    }
                  }}
                  placeholder="NUIT (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white font-mono border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Morada</label>
                <input
                  ref={clientAddressInputRef}
                  type="text"
                  value={clientAddress}
                  disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                  onChange={(e) => setClientAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (documentType === 'CUSTOMER_DELIVERY_NOTE') deliveryLocationRef.current?.focus();
                      else paymentSelectionRef.current?.focus();
                    }
                  }}
                  placeholder="Morada (opcional)"
                  className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              {documentType === 'CUSTOMER_INVOICE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Condição de Pagamento</label>
                  <select
                    ref={paymentSelectionRef}
                    value={paymentSelection}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setPaymentSelection(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#003366] disabled:opacity-60"
                  >
                    {paymentTerms.map((term) => (
                      <option key={term.id} value={`TERM:${term.code}`}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {documentType === 'CASH_SALE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Método de Pagamento</label>
                  <select
                    ref={paymentSelectionRef}
                    value={paymentSelection}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setPaymentSelection(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] font-bold text-[#006e25] disabled:opacity-60"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={`METHOD:${method.code}`}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  {selectedPaymentMethod?.requiresReference && (
                    <input
                      type="text"
                      value={paymentReference}
                      disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      placeholder={`Referência ${selectedPaymentMethod.name}`}
                      className="mt-1.5 w-full rounded border border-[#c3c6d1] bg-white p-1.5 text-xs font-mono dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white"
                    />
                  )}
                </div>
              )}

              {documentType === 'CUSTOMER_DELIVERY_NOTE' && (
                <div>
                  <label className="block font-bold text-[#737780] uppercase mb-0.5 text-[11px] print:text-[9px]">Local de Entrega / Expedição</label>
                  <input
                    ref={deliveryLocationRef}
                    type="text"
                    value={deliveryLocation}
                    disabled={docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY'}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('sale-article-search')?.focus();
                      }
                    }}
                    placeholder="Ex: Armazém Central ou Destino do Cliente"
                    className="w-full bg-white dark:bg-[#282c2e] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 print:p-1 text-xs print:text-[10px] focus-ring font-mono disabled:opacity-60"
                  />
                </div>
              )}
            </div>
          </div>

          {selectedClientId && documentType !== 'CUSTOMER_DELIVERY_NOTE' && (
            <SaleBalanceSummary clientName={selectedClientName} previousBalance={previousBalance}
              documentAmount={totalFinalAmount} accumulatedBalance={newAccumulatedBalance} />
          )}
        </div>
      </section>

      {showClientInvoices && selectedClientId && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-xs uppercase text-red-600">Documentos Pendentes em Aberto - {selectedClientName}</h3>
            <button onClick={() => setShowClientInvoices(false)} className="text-[#737780] hover:text-[#191c1d] dark:hover:text-white font-bold text-xs">✕ Fechar</button>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-2">Documento</th>
                <th className="p-2">Data</th>
                <th className="p-2">Tipo</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Pendente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {documents?.filter(d => d.partyId === selectedClientId && d.outstandingAmount > 0).map(d => (
                <tr key={d.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-2">{d.displayNumber}</td>
                  <td className="p-2">{d.date}</td>
                  <td className="p-2 font-sans">{d.typeName}</td>
                  <td className="p-2 text-right">{formatMZN(d.grandTotal)}</td>
                  <td className="p-2 text-right font-bold text-red-600">{formatMZN(d.outstandingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#001e40] text-white px-4 py-2 text-xs font-bold uppercase flex justify-between items-center">
          <span>Artigos · {documentType === 'CASH_SALE' ? 'Venda a Dinheiro' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura'}</span>
          <span>{items.length} artigo(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#e7e8e9] dark:bg-[#282c2e] text-[#43474f] dark:text-[#c3c6d1] font-bold uppercase border-b border-[#c3c6d1]">
              <tr>
                <th className="p-3 w-48">Código Artigo</th>
                <th className="p-3">Descrição do Item / Artigo</th>
                <th className="p-3 w-20 text-center">Existência</th>
                <th className="p-3 w-24 text-center">Quant.</th>
                <th className="p-3 w-28 text-right">Preço Unit.</th>
                <th className="p-3 w-24 text-center">Desc. MZN</th>
                <th className="p-3 w-20 text-center">IVA %</th>
                <th className="p-3 w-32 text-right">Total c/ IVA</th>
                <th className="p-3 w-16 text-center print:hidden">Acção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f] font-mono">
              {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
                <tr className="bg-[#0000aa]/10 dark:bg-[#282c2e] border-b-2 border-[#003366] print:hidden">
                  <td className="p-2">
                    <ArticleSearchSelect
                      inputId="sale-article-search"
                      articles={articles}
                      selectedArticleId={selectedArticleId}
                      onSelect={handleArticleSelect}
                      loadOptions={articleSearchLoader}
                      onResolveArticle={resolveArticle}
                      onAfterSelect={handleAfterArticleSelect}
                      onEmptyEnter={handleAfterArticleSelect}
                      renderLabel={(a) => `[${a.code}] ${a.description} - ${a.sellPrice.toFixed(2)} MZN (Stock: ${a.stock})`}
                      placeholder="Pesquisar catálogo (opcional)…"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      ref={customDescriptionInputRef}
                      type="text"
                      placeholder="Escreva a descrição do artigo ou serviço (ex: Alinhamento)..."
                      disabled={docStatus === 'CONFIRMING'}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          qtyInputRef.current?.focus();
                          qtyInputRef.current?.select();
                        }
                      }}
                      className="w-full bg-white dark:bg-[#1f2325] dark:text-white border border-[#c3c6d1] dark:border-[#43474f] rounded p-1.5 text-xs font-medium focus-ring"
                    />
                  </td>
                  <td className="p-2 text-center font-bold text-[#006e25]">
                    {findArticle(selectedArticleId)?.stock ?? 0}
                  </td>
                  <td className="p-2">
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          unitPriceInputRef.current?.focus();
                          unitPriceInputRef.current?.select();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold bg-yellow-100 text-black focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-gray-700 dark:text-white">
                    <input
                      ref={unitPriceInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputUnitPrice || (() => { const a = findArticle(selectedArticleId); return a ? getArticlePriceWithIva(a) : 0; })()}
                      onChange={(e) => setInputUnitPrice(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          discountInputRef.current?.focus();
                          discountInputRef.current?.select();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-right text-xs font-bold text-[#001e40] dark:text-white focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={inputDiscount}
                      onChange={(e) => setInputDiscount(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          ivaInputRef.current?.focus();
                          ivaInputRef.current?.select();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-red-600 focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      ref={ivaInputRef}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={inputIva}
                      onChange={(e) => setInputIva(Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full border border-[#c3c6d1] dark:border-[#43474f] dark:bg-[#1f2325] dark:text-white rounded p-1.5 text-center text-xs font-bold text-[#003366] focus:ring-2 focus:ring-[#003366]"
                    />
                  </td>
                  <td className="p-2 text-right font-extrabold text-[#006e25]">
                    {calculateDocumentLine({
                      quantity: inputQty,
                      unitPrice: inputUnitPrice > 0 ? inputUnitPrice : (() => { const a = findArticle(selectedArticleId); return a ? getArticlePriceWithIva(a) : 0; })(),
                      discountAmount: inputDiscount,
                      discountPercent: 0,
                      ivaPercent: inputIva,
                    }).totalWithTax.toFixed(2)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded bg-[#003366] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-400 uppercase tracking-wider"
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              )}

              {items.map((item, index) => (
                <tr key={`${item.articleId}-${index}`} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]">
                  <td className="p-3 font-mono font-bold text-[#003366] dark:text-[#a7c8ff]">{item.code}</td>
                  <td className="p-3 font-sans text-xs">{item.description}</td>
                  <td className="p-3 text-center text-slate-500">
                    {findArticle(item.articleId)?.stock ?? '-'}
                  </td>
                  <td className="p-3 text-center font-bold">{item.quantity}</td>
                  <td className="p-3 text-right">{formatMZN(item.unitPrice)}</td>
                  <td className="p-3 text-center text-red-600">{formatMZN(item.discountAmount || 0)}</td>
                  <td className="p-3 text-center font-bold text-[#003366]">{item.ivaPercent}%</td>
                  <td className="p-3 text-right font-bold text-[#006e25]">{formatMZN(item.total)}</td>
                  <td className="p-3 text-center print:hidden">
                    {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-600 hover:text-red-800 font-bold text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic text-xs">
                    Nenhum artigo inserido. Digite o código do artigo no campo acima e prima Enter para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <SaleTotalsSection generalDiscount={generalDiscount} onGeneralDiscountChange={setGeneralDiscount}
        notes={notes} onNotesChange={setNotes} disabled={docStatus==='CONFIRMED'||docStatus==='READ_ONLY'}
        appliedGeneralDiscount={descontoGeralValor} grossTotal={subtotalBruto} lineDiscountTotal={descontoLinhas}
        netTotal={subtotalLiquido} taxTotal={ivaTotal} grandTotal={totalFinalAmount}>

      {docStatus === 'CONFIRMING' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4 shadow-md font-sans print:hidden">
            <div>
              <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm uppercase">
                Confirmar Emissão de {documentType === 'CASH_SALE' ? 'Venda a Dinheiro' : documentType === 'CUSTOMER_DELIVERY_NOTE' ? 'Guia de Remessa' : 'Factura'}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Cliente: <b>{selectedClientName}</b> | Linhas: <b>{items.length}</b> | Total Final: <b>{formatMZN(totalFinalAmount)}</b>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setDocStatus('PREPARATION')}
                className="px-3 py-1.5 border border-amber-600 text-amber-900 dark:text-amber-200 rounded font-bold text-xs uppercase hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                F3 — Ajustar (ESC)
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveAndConfirm(false)}
                className="px-5 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:bg-green-700 shadow-md"
              >
                {saving ? 'A gravar…' : 'Confirmar (F2 / Enter)'}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-[#c3c6d1] dark:border-[#43474f] print:hidden">
          {saveError && (
            <p role="alert" className="rounded bg-red-100 p-2 text-xs font-bold text-red-800 print:hidden">
              {saveError}
            </p>
          )}

          <div className="flex items-center space-x-3 ml-auto">
            {(docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord && (
              <button
                type="button"
                onClick={() => onOpenPrintModal(confirmedSaleRecord)}
                className="px-5 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:bg-blue-800 shadow-sm"
              >
                Imprimir documento (F9)
              </button>
            )}

            {docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY' && (
              <>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 bg-[#ba1a1a] text-white rounded font-bold text-xs uppercase hover:bg-red-800"
                >
                  Novo (F5)
                </button>
                <button
                  type="button"
                  disabled={saving || items.length === 0}
                  onClick={() => {
                    if (docStatus === 'CONFIRMING') {
                      void handleSaveAndConfirm(true);
                    } else {
                      setDocStatus('CONFIRMING');
                    }
                  }}
                  className="px-4 py-2 bg-[#003366] text-white rounded font-bold text-xs uppercase hover:brightness-110 disabled:opacity-50"
                >
                  Confirmar e imprimir (F9)
                </button>
                <button
                  type="button"
                  disabled={saving || items.length === 0}
                  onClick={handleF2Action}
                  className="px-6 py-2 bg-[#006e25] text-white rounded font-black text-xs uppercase hover:brightness-110 shadow-sm disabled:opacity-50"
                >
                  {saving ? 'A gravar…' : docStatus === 'CONFIRMING' ? 'Confirmar (F2)' : 'Gravar (F2)'}
                </button>
              </>
            )}
          </div>
        </div>
      </SaleTotalsSection>
      <SaleDocumentHistory documents={issuedGuias} guideOnly={isGuiaOnlyUser} operatorName={operatorName}
        onPrint={onOpenPrintModal} onEdit={handleOpenEditSale} />

      <div className="flex flex-col gap-2 rounded border-t border-[#c3c6d1] bg-[#e7e8e9] px-3 py-2 text-xs font-mono font-bold text-[#191c1d] shadow-sm dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <span>ESC=Sair</span>
          <button type="button" onClick={handleF2Action} className="hover:underline">
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">F2=Gravar</span>
          </button>
          <button type="button" onClick={() => setDocStatus('PREPARATION')} className="hover:underline">
            <span>F3=Ajustar</span>
          </button>
          <button type="button" onClick={handleResetForm} className="hover:underline">
            <span>F5=Novo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if ((docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord) {
                onOpenPrintModal(confirmedSaleRecord);
              } else {
                setSaveError('Confirme primeiro o documento com F2 antes de imprimir com F9.');
              }
            }}
            className="hover:underline"
          >
            <span className="bg-[#003366] text-white px-2 py-0.5 rounded">F9=Imp</span>
          </button>
        </div>
        <div className="text-[11px]">
          Tipo Activo: <b className="uppercase text-[#006e25]">{documentType}</b> | Estado: <b>{docStatus}</b> | Cliente: <b>{selectedClientName || 'Nenhum'}</b>
        </div>
      </div>

      {/* Edit Document Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 print:hidden">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-white p-6 shadow-2xl dark:bg-[#1f2325] dark:border-[#43474f] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 text-[#003366] dark:text-[#a7c8ff]">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Editar Documento {editingSale.docNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold">
                {editError}
              </div>
            )}

            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Data de Emissão *
                  </label>
                  <input
                    type="date"
                    value={editDocumentDate}
                    onChange={(e) => setEditDocumentDate(e.target.value)}
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Nome do Cliente / Entidade *
                  </label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    placeholder="Nome do cliente (ex: AUTO COMPANY)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    NUIT do Cliente
                  </label>
                  <input
                    type="text"
                    value={editClientNuit}
                    onChange={(e) => setEditClientNuit(e.target.value)}
                    placeholder="NUIT (opcional)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={editKeepAsWalkIn}
                  onChange={(e) => setEditKeepAsWalkIn(e.target.checked)}
                />
                Manter como Cliente Pontual (não criar ficha; guardar o nome/NUIT/morada neste documento)
              </label>

              {/* Tabela de Edição de Artigos / Items & Prices */}
              <div className="space-y-2 border-t border-b py-3 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-[#003366] dark:text-[#a7c8ff] uppercase text-xs">
                      Artigos / Itens do Documento ({editItems.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditItems(prev => [
                          ...prev,
                          {
                            articleId: `custom-${Date.now()}`,
                            code: 'DIV',
                            description: 'Novo Artigo / Serviço',
                            quantity: 1,
                            unitPrice: 0,
                            discountPercent: 0,
                            discountAmount: 0,
                            ivaPercent: 16,
                            total: 0,
                            lineType: 'MANUAL',
                            stockEffectEnabled: false,
                          }
                        ]);
                      }}
                      className="px-2.5 py-1 bg-[#003366] text-white font-bold rounded text-[11px] hover:bg-blue-900 transition-colors shadow-sm flex items-center gap-1"
                    >
                      <span>+ Artigo Manual</span>
                    </button>
                  </div>
                  <ArticleSearchSelect
                    articles={articles}
                    selectedArticleId=""
                    onSelect={() => undefined}
                    loadOptions={articleSearchLoader}
                    onResolveArticle={appendArticleToEdit}
                    renderLabel={(a) => `[${a.code}] ${a.description} - ${(a.sellPriceWithIva || a.sellPrice).toFixed(2)} MZN (Stock: ${a.stock})`}
                    placeholder="Pesquisar artigo do catálogo..."
                    className="w-full"
                  />
                </div>

                {editItems.length === 0 ? (
                  <div className="text-center py-3 text-gray-400 italic text-xs border rounded border-dashed">
                    Nenhum artigo no documento. Pesquise no catálogo ou clique em "+ Artigo Manual".
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {editItems.map((item, idx) => {
                      const lineTotal = calculateDocumentLine(item).totalWithTax;
                      return (
                      <div key={idx} className="bg-slate-50 dark:bg-[#282c2e] p-2.5 rounded border border-slate-200 dark:border-gray-700 text-xs space-y-1.5">
                        {/* Row 1: Code + Description + Remove */}
                        <div className="flex items-center gap-2">
                          <div className="w-28">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Código</span>
                            <input
                              type="text"
                              value={item.code || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], code: val };
                                  return updated;
                                });
                              }}
                              placeholder="Código..."
                              className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white font-mono font-bold text-xs"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Descrição</span>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], description: val };
                                  return updated;
                                });
                              }}
                              placeholder="Descrição do artigo ou serviço..."
                              className="w-full rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white font-medium text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(prev => {
                                const updated = prev.filter((_, i) => i !== idx);
                                setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                return updated;
                              });
                            }}
                            className="mt-4 p-1 text-red-600 hover:text-red-800 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                            title="Remover Item"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Row 2: quantidade, preço com IVA, desconto em MZN, IVA e total */}
                        <div className="flex items-end gap-2">
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">Qtd</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], quantity: qty });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 dark:bg-[#1f2325] dark:border-gray-600 dark:text-white text-xs"
                            />
                          </div>
                          <div className="w-28">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-right">Preço c/ IVA</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const price = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], unitPrice: price });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              placeholder="0.00"
                              className="w-full text-right font-bold rounded border border-gray-300 p-1.5 text-[#006e25] dark:bg-[#1f2325] dark:border-gray-600 dark:text-white text-xs font-mono"
                            />
                          </div>
                          <div className="w-16">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">Desc. MZN</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.discountAmount || 0}
                              onChange={(e) => {
                                const disc = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = recalculateSaleItem({ ...updated[idx], discountAmount: disc, discountPercent: 0 });
                                  setEditGrandTotal(calculateDocumentTotals(updated, editGeneralDiscount).grandTotal);
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 text-red-600 dark:bg-[#1f2325] dark:border-gray-600 dark:text-red-400 text-xs"
                            />
                          </div>
                          <div className="w-14">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-center">IVA %</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={item.ivaPercent || 16}
                              onChange={(e) => {
                                const iva = Number(e.target.value);
                                setEditItems(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], ivaPercent: iva };
                                  return updated;
                                });
                              }}
                              className="w-full text-center font-bold rounded border border-gray-300 p-1.5 text-[#003366] dark:bg-[#1f2325] dark:border-gray-600 dark:text-[#a7c8ff] text-xs"
                            />
                          </div>
                          <div className="w-28 text-right font-mono font-black text-[#001e40] dark:text-[#a7c8ff] text-xs pb-0.5">
                            {formatMZN(lineTotal)}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Morada do Cliente
                  </label>
                  <input
                    type="text"
                    value={editClientAddress}
                    onChange={(e) => setEditClientAddress(e.target.value)}
                    placeholder="Morada (opcional)"
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Desconto Geral (MZN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editGeneralDiscount}
                    onChange={(e) => setEditGeneralDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono text-red-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Valor Total do Documento (MZN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editGrandTotal}
                    readOnly
                    className="w-full rounded border border-gray-300 p-2 bg-gray-100 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white font-mono font-black text-base text-[#006e25]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Observações / Notas Adicionais
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Adicionar notas adicionais ao documento..."
                  className="w-full rounded border border-gray-300 p-2 dark:bg-[#282c2e] dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="rounded border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editDocumentDate || !editClientName.trim()}
                onClick={handleExecuteSaveEditSale}
                className="rounded bg-[#003366] px-4 py-2 text-xs font-bold text-white hover:bg-[#002244] disabled:opacity-50"
              >
                {isSavingEdit ? 'A guardar…' : 'Gravar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export { NewSale as PosPage };
export default NewSale;
