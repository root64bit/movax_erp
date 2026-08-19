import React, { useState, useMemo } from 'react';
import type { Client, Supplier, DocumentRecord, LedgerRecord, PartyInput } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';
import { FinancialAdviceDocument } from '@/features/documents/components/FinancialAdviceDocument';

export interface EntitiesProps {
  clients: Client[];
  suppliers: Supplier[];
  documents?: DocumentRecord[];
  ledgerEntries?: LedgerRecord[];
  onNewCustomer?: () => void;
  onNewSupplier?: () => void;
  onOpenModal?: (type: 'customer' | 'supplier') => void;
  canCreateCustomer?: boolean;
  canCreateSupplier?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onConfirmAdvice?: (data: any) => Promise<DocumentRecord | string>;
  onPrintRecord?: (doc: DocumentRecord) => void;
  isAdmin?: boolean;
  onUpdateParty?: (type: 'customer' | 'supplier', id: string, input: PartyInput, active?: boolean) => Promise<void>;
  onDeleteParty?: (type: 'customer' | 'supplier', id: string) => Promise<void>;
}

type MainTab = 'CLIENTES' | 'FORNECEDORES';
type SubTab = 'LIST' | 'LEDGER' | 'CREDIT_ADVICE';

export const Entities: React.FC<EntitiesProps> = ({
  clients,
  suppliers,
  documents = [],
  ledgerEntries = [],
  onNewCustomer,
  onNewSupplier,
  onOpenModal,
  canCreateCustomer = true,
  canCreateSupplier = true,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onConfirmAdvice,
  onPrintRecord,
  isAdmin = false,
  onUpdateParty,
  onDeleteParty,
}) => {
  const [mainTab, setMainTab] = useState<MainTab>('CLIENTES');
  const [subTab, setSubTab] = useState<SubTab>('LIST');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [editingParty, setEditingParty] = useState<{ type: 'customer' | 'supplier'; id: string } | null>(null);
  const [partyInput, setPartyInput] = useState<PartyInput>({
    number: '', name: '', taxNumber: '', telephone: '', email: '', address: '', city: '',
    contactPerson: '', creditLimit: 0, paymentTermCode: 'DINHEIRO',
  });
  const [partySaving, setPartySaving] = useState(false);
  const [partyError, setPartyError] = useState('');

  const openPartyEditor = (type: 'customer' | 'supplier', party: Client | Supplier) => {
    setEditingParty({ type, id: party.id });
    setPartyInput({
      number: party.number || party.code || '',
      name: party.name,
      taxNumber: party.nuit || '',
      telephone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      city: '',
      contactPerson: type === 'supplier' ? (party as Supplier).contactPerson || '' : '',
      creditLimit: 0,
      paymentTermCode: 'DINHEIRO',
    });
    setPartyError('');
  };

  const savePartyEdit = async () => {
    if (!editingParty || !onUpdateParty || !partyInput.name.trim() || !partyInput.number.trim()) return;
    try {
      setPartySaving(true);
      setPartyError('');
      await onUpdateParty(editingParty.type, editingParty.id, partyInput, true);
      setEditingParty(null);
    } catch (error) {
      setPartyError(error instanceof Error ? error.message : 'Falha ao guardar a entidade.');
    } finally {
      setPartySaving(false);
    }
  };

  const deactivateParty = async (type: 'customer' | 'supplier', party: Client | Supplier) => {
    if (!onUpdateParty || !window.confirm(`Apagar ${party.name}? O histórico dos documentos será preservado.`)) return;
    const input: PartyInput = {
      number: party.number || party.code || '', name: party.name, taxNumber: party.nuit || '',
      telephone: party.phone || '', email: party.email || '', address: party.address || '', city: '',
      contactPerson: type === 'supplier' ? (party as Supplier).contactPerson || '' : '', creditLimit: 0,
      paymentTermCode: 'DINHEIRO',
    };
    try {
      setPartySaving(true);
      setPartyError('');
      await onUpdateParty(type, party.id, input, false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Falha ao apagar a entidade.');
    } finally {
      setPartySaving(false);
    }
  };

  const totalCustomerPending = useMemo(() => clients.reduce((acc, c) => acc + c.pendingBalance, 0), [clients]);
  const totalSupplierPending = useMemo(() => suppliers.reduce((acc, s) => acc + (s.pendingBalance ?? s.totalPurchases ?? 0), 0), [suppliers]);

  // Filtered Ledger Entries for current account view
  const filteredLedger = useMemo(() => {
    const partyType = mainTab === 'CLIENTES' ? 'CUSTOMER' : 'SUPPLIER';
    return ledgerEntries.filter((entry) => {
      if (entry.partyType !== partyType) return false;
      if (!selectedEntityId) return true;
      const entityName = mainTab === 'CLIENTES' 
        ? clients.find(c => c.id === selectedEntityId)?.name 
        : suppliers.find(s => s.id === selectedEntityId)?.name;
      return entityName ? entry.partyName.toLowerCase().includes(entityName.toLowerCase()) : true;
    });
  }, [ledgerEntries, mainTab, selectedEntityId, clients, suppliers]);

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Module Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white dark:bg-[#1f2325] p-4 rounded-lg shadow-sm border-[#c3c6d1] dark:border-[#43474f]">
        <div>
          <h1 className="text-lg font-black uppercase text-[#001e40] dark:text-[#a7c8ff] flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">groups</span>
            Gestão de Clientes e Fornecedores
          </h1>
          <p className="text-xs text-slate-500">
            Directorias de contactos, extractos de conta corrente e emissão de notas de crédito.
          </p>
        </div>

        {/* Primary Navigation Tabs: CLIENTES / FORNECEDORES */}
        <div className="flex items-center space-x-1 rounded bg-[#e7e8e9] dark:bg-[#282c2e] p-1 border">
          <button
            type="button"
            onClick={() => {
              setMainTab('CLIENTES');
              setSubTab('LIST');
              setSelectedEntityId('');
            }}
            className={`px-5 py-2 rounded text-xs font-black uppercase transition-all flex items-center space-x-2 ${
              mainTab === 'CLIENTES'
                ? 'bg-[#003366] text-white shadow'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1f2325]'
            }`}
          >
            <span className="material-symbols-outlined text-base">person</span>
            <span>Clientes ({clients.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainTab('FORNECEDORES');
              setSubTab('LIST');
              setSelectedEntityId('');
            }}
            className={`px-5 py-2 rounded text-xs font-black uppercase transition-all flex items-center space-x-2 ${
              mainTab === 'FORNECEDORES'
                ? 'bg-[#003366] text-white shadow'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1f2325]'
            }`}
          >
            <span className="material-symbols-outlined text-base">local_shipping</span>
            <span>Fornecedores ({suppliers.length})</span>
          </button>
        </div>
      </div>

      {/* Subcategory Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f3f4f5] dark:bg-[#282c2e] p-2 rounded-lg border border-[#c3c6d1] dark:border-[#43474f]">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab('LIST')}
            className={`px-4 py-1.5 rounded text-xs font-extrabold uppercase transition-colors flex items-center space-x-1 ${
              subTab === 'LIST'
                ? 'bg-white dark:bg-[#1f2325] text-[#001e40] dark:text-[#a7c8ff] shadow border'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1f2325]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">list_alt</span>
            <span>{mainTab === 'CLIENTES' ? 'Lista de Clientes' : 'Lista de Fornecedores'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('LEDGER')}
            className={`px-4 py-1.5 rounded text-xs font-extrabold uppercase transition-colors flex items-center space-x-1 ${
              subTab === 'LEDGER'
                ? 'bg-white dark:bg-[#1f2325] text-[#001e40] dark:text-[#a7c8ff] shadow border'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1f2325]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
            <span>Conta Corrente</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('CREDIT_ADVICE')}
            className={`px-4 py-1.5 rounded text-xs font-extrabold uppercase transition-colors flex items-center space-x-1 ${
              subTab === 'CREDIT_ADVICE'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1f2325]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">savings</span>
            <span>Nota de Crédito</span>
          </button>
        </div>

        {/* Quick Action Button for New Entity */}
        {subTab === 'LIST' && (
          <div>
            {mainTab === 'CLIENTES' && canCreateCustomer && (
              <button
                type="button"
                onClick={onNewCustomer}
                className="rounded bg-[#006e25] hover:bg-[#00551c] px-3 py-1.5 text-xs font-black uppercase text-white shadow"
              >
                + Novo Cliente
              </button>
            )}

            {mainTab === 'FORNECEDORES' && canCreateSupplier && (
              <button
                type="button"
                onClick={onNewSupplier}
                className="rounded bg-[#003366] hover:bg-[#002244] px-3 py-1.5 text-xs font-black uppercase text-white shadow"
              >
                + Novo Fornecedor
              </button>
            )}
          </div>
        )}
      </div>

      {/* Render Subtab 1: Directory List */}
      {subTab === 'LIST' && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
          <div className="bg-[#e7e8e9] dark:bg-[#282c2e] px-4 py-3 flex justify-between items-center border-b border-[#c3c6d1] dark:border-[#43474f]">
            <h3 className="font-bold text-[#001e40] dark:text-[#a7c8ff] flex items-center text-sm">
              <span className="material-symbols-outlined mr-2">
                {mainTab === 'CLIENTES' ? 'groups' : 'local_shipping'}
              </span>
              {mainTab === 'CLIENTES' ? `Directório de Clientes (${clients.length})` : `Directório de Fornecedores (${suppliers.length})`}
            </h3>
            <span className="text-xs font-bold font-mono text-[#ba1a1a]">
              Total Pendente: {formatMZN(mainTab === 'CLIENTES' ? totalCustomerPending : totalSupplierPending)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9fa] dark:bg-[#282c2e] text-[#737780] dark:text-[#c3c6d1] uppercase border-b border-[#c3c6d1] dark:border-[#43474f]">
                <tr>
                  <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Código / Nome</th>
                  <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">NUIT</th>
                  <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Morada</th>
                  <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Telefone</th>
                  <th className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f]">Email</th>
                  <th className="p-3 text-right">Saldo Pendente</th>
                  {isAdmin && <th className="p-3 text-center">Acções</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c6d1] dark:divide-[#43474f]">
                {mainTab === 'CLIENTES'
                  ? clients.map((client) => (
                      <tr key={client.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#191c1d] dark:text-white">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-[11px]">
                              {client.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-[10px] font-mono text-slate-500">[{client.code || client.number || 'CL'}]</div>
                              <span>{client.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono text-[#003366] dark:text-[#a7c8ff]">
                          {client.nuit || 'N/A'}
                        </td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#737780]">{client.address || '—'}</td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono">{client.phone || '—'}</td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#003366] dark:text-[#a7c8ff]">{client.email || '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-sm">
                          <span className={client.pendingBalance > 0 ? 'text-[#ba1a1a]' : 'text-[#006e25]'}>
                            {formatMZN(client.pendingBalance)}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-3">
                            <div className="flex justify-center gap-1.5">
                              <button type="button" onClick={() => openPartyEditor('customer', client)} className="h-8 rounded bg-amber-600 px-3 text-[11px] font-bold text-white hover:bg-amber-700">Editar</button>
                              <button type="button" disabled={partySaving} onClick={() => void deactivateParty('customer', client)} className="h-8 rounded bg-red-700 px-3 text-[11px] font-bold text-white hover:bg-red-800 disabled:opacity-50">Apagar</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  : suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e] transition-colors">
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-bold text-[#191c1d] dark:text-white">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-[#001e40] text-white flex items-center justify-center font-bold text-[11px]">
                              {sup.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-[10px] font-mono text-slate-500">[{sup.code || sup.number || 'FOR'}]</div>
                              <span>{sup.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono text-[#003366] dark:text-[#a7c8ff]">
                          {sup.nuit || 'N/A'}
                        </td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#737780]">{sup.address || '—'}</td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] font-mono">{sup.phone || '—'}</td>
                        <td className="p-3 border-r border-[#c3c6d1] dark:border-[#43474f] text-[#003366] dark:text-[#a7c8ff]">{sup.email || '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-sm">
                          <span className={(sup.pendingBalance ?? sup.totalPurchases ?? 0) > 0 ? 'text-[#ba1a1a]' : 'text-[#006e25]'}>
                            {formatMZN(sup.pendingBalance ?? sup.totalPurchases ?? 0)}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-3">
                            <div className="flex justify-center gap-1.5">
                              <button type="button" onClick={() => openPartyEditor('supplier', sup)} className="h-8 rounded bg-amber-600 px-3 text-[11px] font-bold text-white hover:bg-amber-700">Editar</button>
                              <button type="button" disabled={partySaving} onClick={() => void deactivateParty('supplier', sup)} className="h-8 rounded bg-red-700 px-3 text-[11px] font-bold text-white hover:bg-red-800 disabled:opacity-50">Apagar</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Render Subtab 2: Current Account Ledger */}
      {subTab === 'LEDGER' && (
        <section className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 dark:border-[#43474f]">
            <h3 className="font-bold text-xs uppercase text-[#001e40] dark:text-[#a7c8ff] flex items-center gap-1">
              <span className="material-symbols-outlined text-base">account_balance_wallet</span>
              Extracto de Conta Corrente ({mainTab === 'CLIENTES' ? 'Clientes' : 'Fornecedores'})
            </h3>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold uppercase text-slate-500">Filtrar por Entidade:</label>
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="p-1.5 border rounded text-xs font-bold dark:bg-[#282c2e]"
              >
                <option value="">-- Todas as Entidades --</option>
                {mainTab === 'CLIENTES'
                  ? clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                  : suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold text-slate-700 dark:text-slate-300 border-b">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Entidade</th>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Tipo / Descrição</th>
                  <th className="p-3 text-right">Débito (MZN)</th>
                  <th className="p-3 text-right">Crédito (MZN)</th>
                  <th className="p-3 text-right">Saldo (MZN)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 font-sans text-xs">
                      Sem lançamentos de conta corrente registados para esta selecção.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#282c2e]">
                      <td className="p-3">{row.date}</td>
                      <td className="p-3 font-sans font-bold">{row.partyName}</td>
                      <td className="p-3 font-bold text-[#003366] dark:text-[#a7c8ff]">{row.entryType}</td>
                      <td className="p-3 font-sans">{row.status}</td>
                      <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                        {row.debitAmount > 0 ? formatMZN(row.debitAmount) : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {row.creditAmount > 0 ? formatMZN(row.creditAmount) : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatMZN(row.outstandingAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Render Subtab 3: Nota de Crédito */}
      {subTab === 'CREDIT_ADVICE' && (
        <FinancialAdviceDocument
          entityType={mainTab === 'CLIENTES' ? 'CUSTOMER' : 'SUPPLIER'}
          adviceType="CREDIT"
          clients={clients}
          suppliers={suppliers}
          documents={documents}
          onConfirmAdvice={onConfirmAdvice || (async () => 'mock-id')}
          onPrintRecord={onPrintRecord}
        />
      )}

      {editingParty && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-[#1f2325]">
            <header className="flex items-center justify-between bg-[#001e40] px-5 py-3 text-white">
              <h2 className="text-sm font-black uppercase">
                Editar {editingParty.type === 'customer' ? 'Cliente' : 'Fornecedor'}
              </h2>
              <button type="button" onClick={() => setEditingParty(null)} aria-label="Fechar">✕</button>
            </header>
            <div className="grid gap-3 p-5 text-xs md:grid-cols-2">
              {partyError && <div className="md:col-span-2 rounded bg-red-50 p-3 font-bold text-red-700">{partyError}</div>}
              <label>
                <span className="mb-1 block font-bold uppercase">Código *</span>
                <input required readOnly={partyInput.number === '1'} value={partyInput.number} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, number: e.target.value }))} className="w-full rounded border p-2 read-only:bg-slate-100" />
              </label>
              <label>
                <span className="mb-1 block font-bold uppercase">Nome *</span>
                <input required value={partyInput.name} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, name: e.target.value }))} className="w-full rounded border p-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold uppercase">NUIT</span>
                <input value={partyInput.taxNumber} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, taxNumber: e.target.value }))} className="w-full rounded border p-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold uppercase">Telefone</span>
                <input value={partyInput.telephone} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, telephone: e.target.value }))} className="w-full rounded border p-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold uppercase">Email</span>
                <input type="email" value={partyInput.email} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, email: e.target.value }))} className="w-full rounded border p-2" />
              </label>
              {editingParty.type === 'supplier' && (
                <label>
                  <span className="mb-1 block font-bold uppercase">Pessoa de contacto</span>
                  <input value={partyInput.contactPerson || ''} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, contactPerson: e.target.value }))} className="w-full rounded border p-2" />
                </label>
              )}
              <label className="md:col-span-2">
                <span className="mb-1 block font-bold uppercase">Morada</span>
                <input value={partyInput.address} onChange={(e) => setPartyInput((v: PartyInput) => ({ ...v, address: e.target.value }))} className="w-full rounded border p-2" />
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={() => setEditingParty(null)} className="rounded bg-slate-200 px-4 py-2 text-xs font-black uppercase">Cancelar</button>
              <button type="button" disabled={partySaving || !partyInput.name.trim() || !partyInput.number.trim()} onClick={() => void savePartyEdit()} className="rounded bg-[#006e25] px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50">
                {partySaving ? 'A guardar…' : 'Gravar Alterações'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
export { Entities as EntitiesPage };
export default Entities;
