import React, { useState } from 'react';
import type { BankStatementEntry, DocumentRecord } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { requireSupabase } from '@/integrations/supabase/client';
import { env } from '@/app/config/env';

interface BaixaBancoModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentRecord[];
  onReconciliationSuccess: () => Promise<void>;
}

export const BaixaBancoModal: React.FC<BaixaBancoModalProps> = ({
  isOpen,
  onClose,
  documents,
  onReconciliationSuccess,
}) => {
  const [bankName, setBankName] = useState('BIM');
  const [accountNumber, setAccountNumber] = useState('98765432109');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [movementType, setMovementType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Filter pending documents matching the movement direction
  // CREDIT = Recebimento de Cliente (abate faturas de clientes)
  // DEBIT = Pagamento a Fornecedor (abate faturas de fornecedor)
  const eligibleDocuments = documents.filter((d) => {
    if (d.outstandingAmount <= 0) return false;
    if (movementType === 'CREDIT') {
      return d.partyType === 'CUSTOMER' || d.typeCode.startsWith('CUSTOMER_');
    } else {
      return d.partyType === 'SUPPLIER' || d.typeCode.startsWith('SUPPLIER_');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (!description.trim() || isNaN(amount) || amount <= 0) {
      setError('Preencha a descrição e um valor válido em Meticais (MZN).');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      if (env.useMockData) {
        setSuccessMsg('Movimento bancário registado e reconciliado com sucesso (Modo Demonstração)!');
        await onReconciliationSuccess();
        setTimeout(() => onClose(), 1200);
        return;
      }

      const client = requireSupabase();

      // 1. Insert bank statement entry
      const { data: entryData, error: entryErr } = await client
        .from('bank_statement_entries')
        .insert({
          bank_name: bankName,
          account_number: accountNumber,
          transaction_date: transactionDate,
          description: description.trim(),
          reference_number: referenceNumber.trim() || undefined,
          amount_mzn: amount,
          movement_type: movementType,
          status: selectedDocId ? 'RECONCILED' : 'PENDING',
          reconciled_document_id: selectedDocId || undefined,
          notes: notes.trim() || undefined,
        })
        .select()
        .single();

      if (entryErr) throw entryErr;

      // 2. If a document is associated, run RPC reconciliation
      if (selectedDocId && entryData) {
        const { error: rpcErr } = await client.rpc('reconcile_bank_statement_entry_v1', {
          p_entry_id: entryData.id,
          p_document_id: selectedDocId,
          p_notes: notes.trim() || `Baixa bancária via ${bankName} Ref: ${referenceNumber}`,
        });
        if (rpcErr) throw rpcErr;
      }

      setSuccessMsg('Baixa de banco e reconciliação efetuada com sucesso!');
      await onReconciliationSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar a baixa de banco.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-slate-100">Baixa de Banco & Reconciliação</h3>
              <p className="text-xs text-slate-500">Lançamento de extrato bancário e liquidação direta de faturas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {successMsg && (
          <div role="status" className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Movement Type Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMovementType('CREDIT');
                setSelectedDocId('');
              }}
              className={`py-2 rounded-lg font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                movementType === 'CREDIT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">arrow_downward</span>
              <span>Crédito (Recebimento Cliente)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMovementType('DEBIT');
                setSelectedDocId('');
              }}
              className={`py-2 rounded-lg font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                movementType === 'DEBIT'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">arrow_upward</span>
              <span>Débito (Pagamento Fornecedor)</span>
            </button>
          </div>

          {/* Bank Account & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Banco</label>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800"
              >
                <option value="BIM">Millennium BIM</option>
                <option value="BCI">BCI</option>
                <option value="STANDARD_BANK">Standard Bank</option>
                <option value="MOZA">Moza Banco</option>
                <option value="ABSA">Absa Moçambique</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Conta / NIB</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Ex: 98765432109"
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Data Movimento</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Description & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Descrição do Extrato *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: TRF CLIENTE TRANS-ZAMBEZE"
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nº Comprovativo / Referência</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Ex: FT2026-TRF-001"
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 font-mono bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Amount & Invoice Allocation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Valor (MZN) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 font-mono font-bold text-base bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Associar & Dar Baixa a Fatura
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => {
                  const docId = e.target.value;
                  setSelectedDocId(docId);
                  const found = eligibleDocuments.find((d) => d.id === docId);
                  if (found && (!amountStr || Number(amountStr) <= 0)) {
                    setAmountStr(String(found.outstandingAmount));
                  }
                }}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 font-bold bg-white dark:bg-slate-800"
              >
                <option value="">Apenas Lançar no Extrato (Sem Fatura)</option>
                {eligibleDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.displayNumber} — {doc.partyName} (Pendente: {formatMZN(doc.outstandingAmount)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notas Adicionais</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações da conciliação..."
              className="w-full rounded-xl border border-outline-variant dark:border-slate-700 p-2 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-black shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                'A processar…'
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Confirmar Baixa de Banco</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
