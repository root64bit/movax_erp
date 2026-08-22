import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';
import type { PosDocumentType, PosDocStatus, PosProps } from '../types/pos.types';
import { createPosArticleSearchLoader } from '../utils/posCalculations';
import { recalculateSaleItems } from '@/lib/documentCalculations';
import { usePosCart } from '../hooks/usePosCart';
import { usePosCustomer } from '../hooks/usePosCustomer';
import { usePosItemDraft } from '../hooks/usePosItemDraft';
import { usePosShortcuts } from '../hooks/usePosShortcuts';
import { usePosSubmission } from '../hooks/usePosSubmission';
import { PosHeader } from '../components/PosHeader';
import { PosCustomerSection } from '../components/PosCustomerSection';
import { PosCartTable } from '../components/PosCartTable';
import { PosActionFooter } from '../components/PosActionFooter';
import { PosEditSaleModal } from '../components/PosEditSaleModal';
import { SaleDocumentHistory } from '../components/SaleDocumentHistory';

export const NewSale: React.FC<PosProps> = ({
  articles,
  clients,
  sales = [],
  onCompleteSale,
  onOpenPrintModal,
  canReceivePayment,
  operatorName,
  paymentTerms,
  paymentMethods,
  documents = [],
  permissions = [],
  warehouseId,
  warehouses = [],
  onUpdateDocument,
}) => {
  const isGuiaOnlyUser = permissions.length > 0 && !permissions.includes('settings.manage') && !permissions.includes('products.view');

  const [documentType, setDocumentType] = useState<PosDocumentType>(
    isGuiaOnlyUser ? 'CUSTOMER_DELIVERY_NOTE' : 'CUSTOMER_INVOICE'
  );

  useEffect(() => {
    if (isGuiaOnlyUser && documentType !== 'CUSTOMER_DELIVERY_NOTE') {
      setDocumentType('CUSTOMER_DELIVERY_NOTE');
    }
  }, [isGuiaOnlyUser, documentType]);

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [docNumber, setDocNumber] = useState('A atribuir ao confirmar');
  const [docStatus, setDocStatus] = useState<PosDocStatus>('PREPARATION');

  // Modular Submission hook
  const {
    saving,
    saveError,
    setSaveError,
    confirmedSaleRecord,
    setConfirmedSaleRecord,
    executeSaleSubmission,
    resetSubmission,
    savingRef,
  } = usePosSubmission({
    onCompleteSale,
    onSuccess: (savedSale, shouldPrint) => {
      setDocNumber(savedSale.docNumber || 'CONFIRMADO');
      setDocStatus('CONFIRMED');
      if (shouldPrint) {
        onOpenPrintModal(savedSale);
      }
    },
  });

  // Modular Cart hook
  const {
    items,
    generalDiscount,
    notes,
    totals,
    addItem,
    removeItem,
    setItems,
    setGeneralDiscount,
    setNotes,
    resetCart,
  } = usePosCart();

  // Modular Customer hook
  const {
    clientCodeInput,
    setClientCodeInput,
    selectedClientId,
    setSelectedClientId,
    selectedClientName,
    setSelectedClientName,
    clientNuit,
    setClientNuit,
    clientAddress,
    setClientAddress,
    keepAsWalkIn,
    setKeepAsWalkIn,
    showClientInvoices,
    setShowClientInvoices,
    showClientNameMatches,
    setShowClientNameMatches,
    clientNameMatches,
    applySelectedClient,
    handleClientNameChange,
    lookupClientByCode,
    resetCustomer,
  } = usePosCustomer({ clients });

  // Modular Item Draft hook
  const itemDraft = usePosItemDraft({
    articles,
    docStatus,
    onAddItem: addItem,
  });

  // Payment configuration
  const immediateTerm = paymentTerms.find((item) => item.requiresImmediatePayment);
  const creditTerm = paymentTerms.find((item) => !item.requiresImmediatePayment);
  const receiptMethod = paymentMethods.find((item) => item.allowsCustomerReceipt);
  const defaultCashMethod = paymentMethods.find((item) => item.code === 'CASH') ?? receiptMethod;
  const [paymentSelection, setPaymentSelection] = useState(`TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`);
  const [paymentReference, setPaymentReference] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Edit modal state
  const [editingSale, setEditingSale] = useState<SaleInvoice | null>(null);

  // Refs for keyboard navigation
  const dateInputRef = useRef<HTMLInputElement>(null);
  const clientCodeInputRef = useRef<HTMLInputElement>(null);
  const clientNameInputRef = useRef<HTMLInputElement>(null);
  const clientNuitInputRef = useRef<HTMLInputElement>(null);
  const clientAddressInputRef = useRef<HTMLInputElement>(null);
  const paymentSelectionRef = useRef<HTMLSelectElement>(null);
  const deliveryLocationRef = useRef<HTMLInputElement>(null);

  const articleSearchLoader = useMemo(
    () => createPosArticleSearchLoader(warehouseId),
    [warehouseId]
  );

  const confirmResetIfNeeded = (): boolean => {
    if (items.length > 0 && docStatus !== 'CONFIRMED' && docStatus !== 'READ_ONLY') {
      return window.confirm('Existem artigos/alterações não gravadas. Deseja descartar?');
    }
    return true;
  };

  const handleSelectDocumentType = (type: PosDocumentType) => {
    if (isGuiaOnlyUser && type !== 'CUSTOMER_DELIVERY_NOTE') {
      setSaveError('Acesso Restrito: O Operador de Caixa apenas pode emitir Guia de Remessa.');
      return;
    }
    if (!confirmResetIfNeeded()) return;

    setDocumentType(type);
    setDocStatus('PREPARATION');
    resetCart();
    itemDraft.resetDraft();
    resetSubmission();
    resetCustomer();
    setPaymentReference('');

    if (type === 'CASH_SALE' && defaultCashMethod) {
      setPaymentSelection(`METHOD:${defaultCashMethod.code}`);
    } else if (type === 'CUSTOMER_INVOICE') {
      setPaymentSelection(`TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`);
    }
  };

  const handleResetForm = () => {
    if (!confirmResetIfNeeded()) return;
    resetCart();
    itemDraft.resetDraft();
    resetSubmission();
    setDocStatus('PREPARATION');
    setDocNumber('A atribuir ao confirmar');
    resetCustomer();
    setDeliveryLocation('');
    setPaymentReference('');

    if (documentType === 'CASH_SALE' && defaultCashMethod) {
      setPaymentSelection(`METHOD:${defaultCashMethod.code}`);
    } else {
      setPaymentSelection(`TERM:${immediateTerm?.code ?? creditTerm?.code ?? ''}`);
    }

    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input[placeholder*="Ex: 5"]')?.focus();
    }, 50);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const previousBalance = selectedClient?.pendingBalance ?? 0;
  const selectedPaymentTerm = paymentTerms.find((term) => paymentSelection === `TERM:${term.code}`);
  const selectedPaymentMethod = paymentMethods.find((method) => paymentSelection === `METHOD:${method.code}`) ?? defaultCashMethod;
  const invoiceCreatesDebt = documentType === 'CUSTOMER_INVOICE' && !selectedPaymentTerm?.requiresImmediatePayment;
  const newAccumulatedBalance = previousBalance + (invoiceCreatesDebt ? totals.grandTotal : 0);

  const handleSaveAndConfirm = async (shouldPrint: boolean = false) => {
    if (items.length === 0) {
      setSaveError('Adicione pelo menos 1 artigo ao documento.');
      return;
    }
    if (!selectedClientId) {
      setSaveError('Selecione um cliente válido.');
      return;
    }
    const requiresSettlement =
      documentType === 'CASH_SALE' ||
      (documentType === 'CUSTOMER_INVOICE' && Boolean(selectedPaymentTerm?.requiresImmediatePayment));
    if (requiresSettlement && selectedPaymentMethod?.requiresReference && !paymentReference.trim()) {
      setSaveError(`O método ${selectedPaymentMethod.name} exige uma referência da transacção.`);
      return;
    }

    const newSale: SaleInvoice = {
      id: `sale-${Date.now()}`,
      clientId: selectedClientId,
      documentTypeCode: documentType,
      docNumber: 'A atribuir ao confirmar',
      date,
      clientName: selectedClientName,
      clientNuit,
      clientAddress,
      paymentMethod: paymentSelection.startsWith('METHOD:')
        ? paymentSelection.replace('METHOD:', '')
        : defaultCashMethod?.code ?? 'CASH',
      paymentReference: paymentReference.trim() || undefined,
      paymentTermCode: paymentSelection.startsWith('TERM:') ? paymentSelection.replace('TERM:', '') : undefined,
      sellerName: operatorName,
      items: totals.lines,
      subtotalBruto: totals.grossTotal,
      descontoTotal: totals.lineDiscountTotal + totals.generalDiscount,
      subtotalLiquido: totals.netTotal,
      ivaTotal: totals.taxTotal,
      totalAmount: totals.grandTotal,
      paidAmount:
        documentType === 'CASH_SALE' || (documentType === 'CUSTOMER_INVOICE' && selectedPaymentTerm?.requiresImmediatePayment)
          ? totals.grandTotal
          : 0,
      pendingAmount:
        documentType === 'CASH_SALE' || documentType === 'CUSTOMER_DELIVERY_NOTE' || selectedPaymentTerm?.requiresImmediatePayment
          ? 0
          : totals.grandTotal,
      status: 'Concluída',
      notes,
      keepAsWalkIn,
    };

    try {
      await executeSaleSubmission(newSale, { shouldPrint });
    } catch {
      // Handled and stored in saveError via usePosSubmission
    }
  };

  const isOperationalFormEmpty = () => {
    const normalizedName = selectedClientName.trim().toLowerCase();
    const isDefaultCustomer = !normalizedName || normalizedName === 'cliente pontual' || normalizedName === 'cliente final';
    const normalizedCode = clientCodeInput.trim();
    return (
      items.length === 0 &&
      !itemDraft.selectedArticleId &&
      !itemDraft.customDescription.trim() &&
      itemDraft.inputUnitPrice === 0 &&
      itemDraft.inputDiscount === 0 &&
      generalDiscount === 0 &&
      !notes.trim() &&
      !clientNuit.trim() &&
      !clientAddress.trim() &&
      !deliveryLocation.trim() &&
      !paymentReference.trim() &&
      isDefaultCustomer &&
      (!normalizedCode || normalizedCode === '1' || normalizedCode === '01')
    );
  };

  const handleLoadLastDocument = () => {
    const lastDocument = sales.find(
      (sale) =>
        ['CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_DELIVERY_NOTE'].includes(sale.documentTypeCode || '') &&
        sale.status !== 'Cancelada'
    );

    if (!lastDocument) {
      setSaveError('Ainda não existe uma factura, VD ou guia emitida para consultar.');
      return;
    }

    const recoveredType = (lastDocument.documentTypeCode || 'CUSTOMER_INVOICE') as PosDocumentType;
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
    if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
      handleResetForm();
      return;
    }
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

  usePosShortcuts({
    docStatus,
    confirmedSaleRecord,
    onF2: handleF2Action,
    onF3: () => {
      if (docStatus === 'CONFIRMING') {
        setDocStatus('PREPARATION');
      } else if (docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') {
        setSaveError('Documento já confirmado/leitura. Alterações directas bloqueadas.');
      }
    },
    onF5: handleResetForm,
    onF9: () => {
      if ((docStatus === 'CONFIRMED' || docStatus === 'READ_ONLY') && confirmedSaleRecord) {
        onOpenPrintModal(confirmedSaleRecord);
      } else {
        setSaveError('Confirme primeiro o documento com F2 antes de imprimir (F9).');
      }
    },
    onEscape: () => setDocStatus('PREPARATION'),
  });

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

  return (
    <div className="space-y-4 pb-12 font-sans">
      <PosHeader
        documentType={documentType}
        docStatus={docStatus}
        docNumber={docNumber}
        isGuiaOnlyUser={isGuiaOnlyUser}
        onSelectDocumentType={handleSelectDocumentType}
        onResetForm={handleResetForm}
      />

      <PosCustomerSection
        documentType={documentType}
        docStatus={docStatus}
        date={date}
        onDateChange={setDate}
        dateInputRef={dateInputRef}
        clientCodeInput={clientCodeInput}
        onClientCodeChange={setClientCodeInput}
        onLookupClientByCode={lookupClientByCode}
        clientCodeInputRef={clientCodeInputRef}
        selectedClientId={selectedClientId}
        selectedClientName={selectedClientName}
        onClientNameChange={handleClientNameChange}
        clientNameInputRef={clientNameInputRef}
        clientNameMatches={clientNameMatches}
        showClientNameMatches={showClientNameMatches}
        setShowClientNameMatches={setShowClientNameMatches}
        onApplySelectedClient={applySelectedClient}
        keepAsWalkIn={keepAsWalkIn}
        onKeepAsWalkInChange={setKeepAsWalkIn}
        clientNuit={clientNuit}
        onClientNuitChange={setClientNuit}
        clientNuitInputRef={clientNuitInputRef}
        clientAddress={clientAddress}
        onClientAddressChange={setClientAddress}
        clientAddressInputRef={clientAddressInputRef}
        paymentSelection={paymentSelection}
        onPaymentSelectionChange={setPaymentSelection}
        paymentSelectionRef={paymentSelectionRef}
        paymentReference={paymentReference}
        onPaymentReferenceChange={setPaymentReference}
        paymentTerms={paymentTerms}
        paymentMethods={paymentMethods}
        selectedPaymentMethod={selectedPaymentMethod}
        deliveryLocation={deliveryLocation}
        onDeliveryLocationChange={setDeliveryLocation}
        deliveryLocationRef={deliveryLocationRef}
        previousBalance={previousBalance}
        totalFinalAmount={totals.grandTotal}
        newAccumulatedBalance={newAccumulatedBalance}
        documents={documents}
        showClientInvoices={showClientInvoices}
        onCloseClientInvoices={() => setShowClientInvoices(false)}
      />

      <PosCartTable
        documentType={documentType}
        docStatus={docStatus}
        items={items}
        articles={articles}
        draft={itemDraft}
        articleSearchLoader={articleSearchLoader}
        onRemoveItem={removeItem}
      />

      <PosActionFooter
        documentType={documentType}
        docStatus={docStatus}
        generalDiscount={generalDiscount}
        onGeneralDiscountChange={setGeneralDiscount}
        notes={notes}
        onNotesChange={setNotes}
        appliedGeneralDiscount={totals.generalDiscount}
        grossTotal={totals.grossTotal}
        lineDiscountTotal={totals.lineDiscountTotal}
        netTotal={totals.netTotal}
        taxTotal={totals.taxTotal}
        grandTotal={totals.grandTotal}
        selectedClientName={selectedClientName}
        itemCount={items.length}
        saving={saving}
        saveError={saveError}
        confirmedSaleRecord={confirmedSaleRecord}
        onAdjust={() => setDocStatus('PREPARATION')}
        onResetForm={handleResetForm}
        onSaveAndConfirm={handleSaveAndConfirm}
        onF2Action={handleF2Action}
        onOpenPrintModal={onOpenPrintModal}
        setSaveError={setSaveError}
        setDocStatus={setDocStatus}
      />

      <SaleDocumentHistory
        documents={issuedGuias}
        guideOnly={isGuiaOnlyUser}
        operatorName={operatorName}
        onPrint={onOpenPrintModal}
        onEdit={(doc) => setEditingSale(doc)}
      />

      <PosEditSaleModal
        editingSale={editingSale}
        articles={articles}
        articleSearchLoader={articleSearchLoader}
        onClose={() => setEditingSale(null)}
        onUpdateDocument={onUpdateDocument}
      />
    </div>
  );
};

export { NewSale as PosPage };
export default NewSale;
