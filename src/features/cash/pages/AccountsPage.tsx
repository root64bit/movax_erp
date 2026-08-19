import React, { useEffect, useMemo, useState } from 'react';
import type { CashSession, Client, DocumentRecord, LedgerRecord, PaymentRecord } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { CashService } from '../services/cash.service';
import { BaixaBancoModal } from '@/features/accounts/components/BaixaBancoModal';
import { exportToExcel, exportToWord, exportToPdf } from '@/shared/utils/export.utils';

export interface AccountsProps {
  payments: PaymentRecord[];
  ledger?: LedgerRecord[];
  ledgers?: LedgerRecord[];
  clients?: Client[];
  suppliers?: import('@/shared/types/domain.types').Supplier[];
  documents?: DocumentRecord[];
  paymentMethods?: import('@/shared/types/domain.types').ReferenceOption[];
  onPrintPayment?: (payment: PaymentRecord) => void;
  onPrintRecord?: (doc: DocumentRecord) => void;
  onReceiveDocument?: (document: DocumentRecord) => void;
  onPayDocument?: (document: DocumentRecord) => void;
  onOpenReceiptModal?: (doc: DocumentRecord) => void;
  onDirectPayment?: (
    partyType: 'CUSTOMER' | 'SUPPLIER',
    partyId: string,
    method: string,
    amt: number,
    desc?: string,
  ) => Promise<void>;
  canReceive?: boolean;
  canPay?: boolean;
  canCash?: boolean;
  canManageCash?: boolean;
  canRegisterPayment?: boolean;
  onRefreshData?: () => Promise<void>;
}

export function Accounts({
  payments = [],
  ledger = [],
  ledgers = [],
  clients = [],
  suppliers = [],
  documents = [],
  paymentMethods = [],
  onPrintPayment = () => {},
  onPrintRecord = () => {},
  onReceiveDocument,
  onPayDocument,
  onOpenReceiptModal,
  onDirectPayment,
  canReceive = false,
  canPay = false,
  canCash = false,
  canManageCash = false,
  canRegisterPayment = false,
  onRefreshData,
}: AccountsProps) {
  const [view, setView] = useState<'cash' | 'open' | 'payments' | 'ledger'>(canCash ? 'cash' : 'open');
  const [partyType, setPartyType] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [movementType, setMovementType] = useState<'REINFORCEMENT' | 'WITHDRAWAL'>('REINFORCEMENT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNote, setMovementNote] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [lastClosedSession, setLastClosedSession] = useState<CashSession | null>(null);

  // Baixa de banco modal state
  const [isBaixaBancoOpen, setIsBaixaBancoOpen] = useState(false);

  const loadCashSessions = async () => {
    if (!canCash) return;
    setCashLoading(true);
    setCashError('');
    try {
      setCashSessions(await CashService.fetchCashSessions(20));
    } catch (error: any) {
      setCashError(error?.message || 'Falha ao carregar o caixa.');
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    void loadCashSessions();
  }, [canCash]);

  const openSession = cashSessions.find((session) => session.status === 'OPEN');

  const handleOpenCash = async () => {
    const amount = Number(openingAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) return;
    setCashLoading(true);
    setCashError('');
    try {
      await CashService.openSession(amount);
      setOpeningAmount('');
      await loadCashSessions();
    } catch (error: any) {
      setCashError(error?.message || 'Falha ao abrir o caixa.');
    } finally {
      setCashLoading(false);
    }
  };

  const handleCashMovement = async () => {
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (movementType === 'WITHDRAWAL' && !movementNote.trim()) {
      setCashError('Indique o motivo da sangria.');
      return;
    }
    setCashLoading(true);
    setCashError('');
    try {
      await CashService.addMovement(movementType, amount, movementNote);
      setMovementAmount('');
      setMovementNote('');
      await loadCashSessions();
    } catch (error: any) {
      setCashError(error?.message || 'Falha ao registar o movimento.');
    } finally {
      setCashLoading(false);
    }
  };

  const handleCloseCash = async () => {
    const amount = Number(closingAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    setCashLoading(true);
    setCashError('');
    try {
      const closed = await CashService.closeSession(amount, closingNote);
      setLastClosedSession(closed);
      setClosingAmount('');
      setClosingNote('');
      await loadCashSessions();
    } catch (error: any) {
      setCashError(error?.message || 'Falha ao fechar o caixa.');
    } finally {
      setCashLoading(false);
    }
  };

  const openDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return documents.filter((document) => {
      const isReceivable = document.partyType === 'CUSTOMER' && document.typeCode === 'CUSTOMER_INVOICE';
      const isPayable =
        document.partyType === 'SUPPLIER' &&
        ['SUPPLIER_INVOICE', 'SUPPLIER_OPENING_BALANCE'].includes(document.typeCode);
      const matchesParty = partyType === 'ALL' || document.partyType === partyType;
      const matchesSearch =
        !term ||
        document.displayNumber.toLowerCase().includes(term) ||
        document.partyName.toLowerCase().includes(term) ||
        (document.partyCode || '').toLowerCase().includes(term);
      return (
        (isReceivable || isPayable) &&
        document.outstandingAmount > 0 &&
        !['CANCELLED', 'REVERSED'].includes(document.status) &&
        matchesParty &&
        matchesSearch
      );
    });
  }, [documents, partyType, searchTerm]);

  const filteredPayments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesParty =
        partyType === 'ALL' ||
        (partyType === 'CUSTOMER' && payment.direction === 'CUSTOMER_RECEIPT') ||
        (partyType === 'SUPPLIER' && payment.direction === 'SUPPLIER_PAYMENT');
      const matchesSearch =
        !term ||
        payment.displayNumber.toLowerCase().includes(term) ||
        payment.partyName.toLowerCase().includes(term);
      return matchesParty && matchesSearch;
    });
  }, [partyType, payments, searchTerm]);

  const runningBalances = useMemo(() => {
    const balances = new Map<string, number>();
    const byEntry = new Map<string, number>();
    [...ledger]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((entry) => {
        const key = `${entry.partyType}:${entry.partyName}`;
        const movement =
          entry.partyType === 'CUSTOMER'
            ? entry.debitAmount - entry.creditAmount
            : entry.creditAmount - entry.debitAmount;
        const next = Math.round(((balances.get(key) || 0) + movement) * 100) / 100;
        balances.set(key, next);
        byEntry.set(entry.id, next);
      });
    return byEntry;
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ledger.filter((entry) => {
      const matchesParty = partyType === 'ALL' || entry.partyType === partyType;
      return (
        matchesParty &&
        (!term || entry.partyName.toLowerCase().includes(term) || entry.entryType.toLowerCase().includes(term))
      );
    });
  }, [ledger, partyType, searchTerm]);

  const receivableTotal = openDocuments
    .filter((document) => document.partyType === 'CUSTOMER')
    .reduce((sum, document) => sum + document.outstandingAmount, 0);
  const payableTotal = openDocuments
    .filter((document) => document.partyType === 'SUPPLIER')
    .reduce((sum, document) => sum + document.outstandingAmount, 0);

  // Universal exports for financial data
  const handleExportExcel = () => {
    if (view === 'open') {
      exportToExcel(
        {
          title: 'Pendentes de Contas a Receber e Pagar',
          date: new Date().toLocaleDateString('pt-MZ'),
          headers: ['Documento', 'Data', 'Direção', 'Entidade', 'Total (MZN)', 'Pago (MZN)', 'Pendente (MZN)', 'Estado'],
          rows: openDocuments.map((d) => [
            d.displayNumber,
            d.date,
            d.partyType === 'CUSTOMER' ? 'A receber' : 'A pagar',
            d.partyName,
            d.grandTotal.toFixed(2),
            d.paidAmount.toFixed(2),
            d.outstandingAmount.toFixed(2),
            d.status,
          ]),
          totals: [
            { label: 'Total a Receber', value: receivableTotal.toFixed(2) },
            { label: 'Total a Pagar', value: payableTotal.toFixed(2) },
          ],
        },
        'contas_pendentes',
      );
    } else if (view === 'payments') {
      exportToExcel(
        {
          title: 'Histórico de Pagamentos e Recibos',
          date: new Date().toLocaleDateString('pt-MZ'),
          headers: ['Número', 'Data', 'Direção', 'Entidade', 'Total (MZN)', 'Alocado (MZN)', 'Não Aplicado (MZN)', 'Estado'],
          rows: filteredPayments.map((p) => [
            p.displayNumber,
            p.date,
            p.direction === 'CUSTOMER_RECEIPT' ? 'Recebimento' : 'Pagamento',
            p.partyName,
            p.totalAmount.toFixed(2),
            p.allocatedAmount.toFixed(2),
            p.unappliedAmount.toFixed(2),
            p.status,
          ]),
        },
        'recibos_pagamentos',
      );
    } else {
      exportToExcel(
        {
          title: 'Extrato Geral de Contas Correntes',
          date: new Date().toLocaleDateString('pt-MZ'),
          headers: ['Data', 'Entidade', 'Tipo', 'Débito (MZN)', 'Crédito (MZN)', 'Saldo (MZN)', 'Estado'],
          rows: filteredLedger.map((l) => [
            l.date,
            l.partyName,
            l.entryType,
            l.debitAmount.toFixed(2),
            l.creditAmount.toFixed(2),
            (runningBalances.get(l.id) || 0).toFixed(2),
            l.status,
          ]),
        },
        'extrato_contas_correntes',
      );
    }
  };

  const handleExportPdf = () => {
    if (view === 'open') {
      exportToPdf({
        title: 'Mapa de Contas Pendentes (Receber / Pagar)',
        date: new Date().toLocaleDateString('pt-MZ'),
        headers: ['Documento', 'Data', 'Direção', 'Entidade', 'Total (MZN)', 'Pendente (MZN)'],
        rows: openDocuments.map((d) => [
          d.displayNumber,
          d.date,
          d.partyType === 'CUSTOMER' ? 'A receber' : 'A pagar',
          d.partyName,
          d.grandTotal.toFixed(2),
          d.outstandingAmount.toFixed(2),
        ]),
        totals: [
          { label: 'Total a Receber de Clientes', value: receivableTotal.toFixed(2) },
          { label: 'Total a Pagar a Fornecedores', value: payableTotal.toFixed(2) },
        ],
      });
    } else {
      exportToPdf({
        title: 'Extrato de Conta Corrente',
        date: new Date().toLocaleDateString('pt-MZ'),
        headers: ['Data', 'Entidade', 'Operação', 'Débito (MZN)', 'Crédito (MZN)', 'Saldo (MZN)'],
        rows: filteredLedger.map((l) => [
          l.date,
          l.partyName,
          l.entryType,
          l.debitAmount.toFixed(2),
          l.creditAmount.toFixed(2),
          (runningBalances.get(l.id) || 0).toFixed(2),
        ]),
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header and Baixa de Banco Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c3c6d1] bg-white p-4 dark:border-[#43474f] dark:bg-[#1f2325]">
        <div className="flex flex-wrap gap-2">
          {([
            ...(canCash ? [['cash', 'Caixa do turno']] : []),
            ['open', 'Contas a receber/pagar'],
            ['payments', 'Pagamentos e recibos'],
            ['ledger', 'Contas correntes'],
          ] as Array<[typeof view, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`rounded-lg px-4 py-2 text-xs font-black uppercase transition-all cursor-pointer ${
                view === key ? 'bg-[#003366] text-white shadow-sm' : 'bg-[#e7e8e9] text-[#30343b] hover:bg-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Baixa de Banco Button */}
          <button
            type="button"
            onClick={() => setIsBaixaBancoOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">account_balance</span>
            <span>Baixa de Banco</span>
          </button>

          {/* Export Buttons */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
            title="Exportar tabela para Excel"
          >
            <span className="material-symbols-outlined text-sm">table_view</span>
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs font-bold hover:bg-red-100 cursor-pointer"
            title="Imprimir ou Exportar para PDF"
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span>PDF</span>
          </button>
        </div>

        {view !== 'cash' && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar por código, nome ou nº..."
              className="w-full min-w-0 rounded border border-[#c3c6d1] bg-white px-3 py-2 text-xs dark:border-[#43474f] dark:bg-[#282c2e] dark:text-white sm:min-w-[220px]"
            />
            <select
              value={partyType}
              onChange={(event) => setPartyType(event.target.value as typeof partyType)}
              className="w-full rounded border border-[#c3c6d1] bg-white p-2 text-sm dark:border-[#43474f] dark:bg-[#282c2e] sm:w-auto"
            >
              <option value="ALL">Clientes e fornecedores</option>
              <option value="CUSTOMER">Clientes</option>
              <option value="SUPPLIER">Fornecedores</option>
            </select>
          </div>
        )}
      </div>

      {view === 'cash' && (
        <section className="space-y-4 rounded-xl border border-[#c3c6d1] bg-white p-4 shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e1e3e8] pb-4 dark:border-[#43474f]">
            <div>
              <h2 className="text-lg font-black text-[#003366] dark:text-[#a7c8ff]">Caixa do turno</h2>
              <p className="mt-1 max-w-2xl text-xs text-[#737780]">
                Abra o caixa no início do turno. No fecho, introduza apenas o dinheiro contado fisicamente; o valor esperado só é revelado depois de confirmar.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                openSession ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {openSession ? 'Caixa aberto' : 'Caixa fechado'}
            </span>
          </div>

          {cashError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{cashError}</div>
          )}

          {!openSession ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="text-xs font-black uppercase text-[#737780]">
                Fundo inicial (MZN)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingAmount}
                  onChange={(event) => setOpeningAmount(event.target.value)}
                  placeholder="0,00"
                  className="mt-1 w-full rounded border border-[#c3c6d1] bg-white px-3 py-2 text-base font-bold dark:border-[#43474f] dark:bg-[#282c2e]"
                />
              </label>
              <button
                disabled={cashLoading}
                onClick={handleOpenCash}
                className="rounded bg-[#006e25] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
              >
                Abrir caixa
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg bg-[#f4f6f8] p-3 dark:bg-[#282c2e]">
                  <span className="block text-[11px] font-black uppercase text-[#737780]">Aberto em</span>
                  <strong className="text-sm">{new Date(openSession.openedAt).toLocaleString('pt-MZ')}</strong>
                </div>
                <div className="rounded-lg bg-[#f4f6f8] p-3 dark:bg-[#282c2e]">
                  <span className="block text-[11px] font-black uppercase text-[#737780]">Fundo inicial</span>
                  <strong className="font-mono text-base">{formatMZN(openSession.openingAmount)}</strong>
                </div>
                <div className="rounded-lg border border-dashed border-[#c3c6d1] p-3">
                  <span className="block text-[11px] font-black uppercase text-[#737780]">Valor esperado</span>
                  <strong className="text-sm">Oculto até ao fecho</strong>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-[#d6d9df] p-3 md:grid-cols-[170px_160px_1fr_auto] md:items-end dark:border-[#43474f]">
                <label className="text-xs font-black uppercase text-[#737780]">
                  Movimento
                  <select
                    value={movementType}
                    onChange={(event) => setMovementType(event.target.value as typeof movementType)}
                    className="mt-1 w-full rounded border border-[#c3c6d1] bg-white p-2 dark:border-[#43474f] dark:bg-[#282c2e]"
                  >
                    <option value="REINFORCEMENT">Reforço</option>
                    <option value="WITHDRAWAL">Sangria</option>
                  </select>
                </label>
                <label className="text-xs font-black uppercase text-[#737780]">
                  Valor (MZN)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={movementAmount}
                    onChange={(event) => setMovementAmount(event.target.value)}
                    className="mt-1 w-full rounded border border-[#c3c6d1] bg-white p-2 dark:border-[#43474f] dark:bg-[#282c2e]"
                  />
                </label>
                <label className="text-xs font-black uppercase text-[#737780]">
                  Motivo / nota
                  <input
                    value={movementNote}
                    onChange={(event) => setMovementNote(event.target.value)}
                    placeholder={movementType === 'WITHDRAWAL' ? 'Obrigatório para sangria' : 'Opcional'}
                    className="mt-1 w-full rounded border border-[#c3c6d1] bg-white p-2 dark:border-[#43474f] dark:bg-[#282c2e]"
                  />
                </label>
                <button
                  disabled={cashLoading}
                  onClick={handleCashMovement}
                  className="rounded bg-[#003366] px-4 py-2 text-xs font-black text-white disabled:opacity-50 cursor-pointer"
                >
                  Registar
                </button>
              </div>

              <div className="rounded-lg border-2 border-[#003366] p-4 dark:border-[#6ca7e8]">
                <h3 className="font-black text-[#003366] dark:text-[#a7c8ff]">Fecho cego</h3>
                <p className="mb-3 mt-1 text-xs text-[#737780]">
                  Conte fisicamente notas e moedas. Não mostramos o valor calculado antes do fecho.
                </p>
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
                  <label className="text-xs font-black uppercase text-[#737780]">
                    Dinheiro contado (MZN)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={closingAmount}
                      onChange={(event) => setClosingAmount(event.target.value)}
                      className="mt-1 w-full rounded border border-[#c3c6d1] bg-white p-2 text-base font-bold dark:border-[#43474f] dark:bg-[#282c2e]"
                    />
                  </label>
                  <label className="text-xs font-black uppercase text-[#737780]">
                    Observação
                    <input
                      value={closingNote}
                      onChange={(event) => setClosingNote(event.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded border border-[#c3c6d1] bg-white p-2 dark:border-[#43474f] dark:bg-[#282c2e]"
                    />
                  </label>
                  <button
                    disabled={cashLoading || closingAmount === ''}
                    onClick={handleCloseCash}
                    className="rounded bg-[#ba1a1a] px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
                  >
                    Fechar caixa
                  </button>
                </div>
              </div>
            </div>
          )}

          {lastClosedSession && (
            <div
              className={`rounded-lg border p-4 ${
                (lastClosedSession.varianceAmount || 0) === 0
                  ? 'border-green-200 bg-green-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <span className="block text-xs font-black uppercase">Resultado do último fecho</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  Esperado
                  <br />
                  <strong>{formatMZN(lastClosedSession.expectedClosingAmount || 0)}</strong>
                </div>
                <div>
                  Contado
                  <br />
                  <strong>{formatMZN(lastClosedSession.declaredClosingAmount || 0)}</strong>
                </div>
                <div>
                  Diferença
                  <br />
                  <strong>{formatMZN(lastClosedSession.varianceAmount || 0)}</strong>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-black uppercase text-[#737780]">Últimos turnos</h3>
            {cashLoading && cashSessions.length === 0 ? (
              <p className="text-sm text-[#737780]">A carregar...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-[#f1f3f5] uppercase text-[#737780] dark:bg-[#282c2e]">
                    <tr>
                      <th className="p-2">Abertura</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2 text-right">Fundo</th>
                      <th className="p-2 text-right">Contado</th>
                      <th className="p-2 text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashSessions.map((session) => (
                      <tr key={session.id} className="border-b border-[#e1e3e8] dark:border-[#43474f]">
                        <td className="p-2">{new Date(session.openedAt).toLocaleString('pt-MZ')}</td>
                        <td className="p-2 font-bold">{session.status === 'OPEN' ? 'Aberto' : 'Fechado'}</td>
                        <td className="p-2 text-right font-mono">{formatMZN(session.openingAmount)}</td>
                        <td className="p-2 text-right font-mono">
                          {session.status === 'CLOSED' ? formatMZN(session.declaredClosingAmount || 0) : '—'}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {session.status === 'CLOSED' ? formatMZN(session.varianceAmount || 0) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {view === 'open' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
            <span className="block text-xs font-black uppercase">Total a receber</span>
            <strong className="font-mono text-xl">{formatMZN(receivableTotal)}</strong>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <span className="block text-xs font-black uppercase">Total a pagar</span>
            <strong className="font-mono text-xl">{formatMZN(payableTotal)}</strong>
          </div>
        </div>
      )}

      {view !== 'cash' && (
        <section className="overflow-hidden rounded border border-[#c3c6d1] bg-white shadow-sm dark:border-[#43474f] dark:bg-[#1f2325]">
          <div className="overflow-x-auto">
            {view === 'open' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]">
                  <tr>
                    <th className="p-3">Documento</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Direção</th>
                    <th className="p-3">Entidade</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Pago</th>
                    <th className="p-3 text-right">Pendente</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                  {openDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#737780]">
                        Não existem documentos pendentes para este filtro.
                      </td>
                    </tr>
                  ) : (
                    openDocuments.map((document) => (
                      <tr key={document.id}>
                        <td className="p-3 font-mono font-bold">{document.displayNumber}</td>
                        <td className="p-3">{document.date}</td>
                        <td className="p-3">{document.partyType === 'CUSTOMER' ? 'A receber' : 'A pagar'}</td>
                        <td className="p-3 font-bold">{document.partyName}</td>
                        <td className="p-3 text-right font-mono">{formatMZN(document.grandTotal)}</td>
                        <td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(document.paidAmount)}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#ba1a1a]">
                          {formatMZN(document.outstandingAmount)}
                        </td>
                        <td className="p-3">{document.status}</td>
                        <td className="p-3">
                          {document.partyType === 'CUSTOMER' ? (
                            <button
                              disabled={!canReceive}
                              onClick={() => onReceiveDocument?.(document)}
                              className="rounded bg-[#006e25] px-3 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                            >
                              Receber
                            </button>
                          ) : (
                            <button
                              disabled={!canPay}
                              onClick={() => onPayDocument?.(document)}
                              className="rounded bg-[#ba1a1a] px-3 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                            >
                              Pagar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : view === 'payments' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]">
                  <tr>
                    <th className="p-3">Número</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Direção</th>
                    <th className="p-3">Entidade</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Alocado</th>
                    <th className="p-3 text-right">Não aplicado</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#737780]">
                        Ainda não existem pagamentos ou recibos registados.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="p-3 font-mono font-bold">{payment.displayNumber}</td>
                        <td className="p-3">{payment.date}</td>
                        <td className="p-3">
                          {payment.direction === 'CUSTOMER_RECEIPT' ? 'Recebimento' : 'Pagamento'}
                        </td>
                        <td className="p-3 font-bold">{payment.partyName}</td>
                        <td className="p-3 text-right font-mono">{formatMZN(payment.totalAmount)}</td>
                        <td className="p-3 text-right font-mono text-[#006e25]">{formatMZN(payment.allocatedAmount)}</td>
                        <td className="p-3 text-right font-mono text-[#ba1a1a]">
                          {formatMZN(payment.unappliedAmount)}
                        </td>
                        <td className="p-3">{payment.status}</td>
                        <td className="p-3">
                          <button
                            onClick={() => onPrintPayment(payment)}
                            className="rounded bg-[#003366] px-2 py-1 font-bold text-white cursor-pointer"
                          >
                            Imprimir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#e7e8e9] uppercase text-[#737780] dark:bg-[#282c2e]">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Entidade</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3 text-right">Débito</th>
                    <th className="p-3 text-right">Crédito</th>
                    <th className="p-3 text-right">Saldo</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#737780]">
                        Ainda não existem lançamentos para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="p-3">{entry.date}</td>
                        <td className="p-3 font-bold">{entry.partyName}</td>
                        <td className="p-3">{entry.entryType}</td>
                        <td className="p-3 text-right font-mono">{formatMZN(entry.debitAmount)}</td>
                        <td className="p-3 text-right font-mono">{formatMZN(entry.creditAmount)}</td>
                        <td className="p-3 text-right font-mono font-bold">
                          {formatMZN(runningBalances.get(entry.id) || 0)}
                        </td>
                        <td className="p-3">{entry.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* Baixa de Banco & Reconciliação Modal */}
      <BaixaBancoModal
        isOpen={isBaixaBancoOpen}
        onClose={() => setIsBaixaBancoOpen(false)}
        documents={documents}
        onReconciliationSuccess={async () => {
          if (onRefreshData) await onRefreshData();
        }}
      />
    </div>
  );
}

export { Accounts as AccountsPage };
export default Accounts;
