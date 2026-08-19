import React, { useEffect, useMemo, useState } from 'react';
import type { Client, DocumentRecord, Supplier } from '../types';
import { formatMZN } from '../stitch/stitchConfig';

interface CreditLine {
  sourceLineId: string;
  code: string;
  description: string;
  quantity: number;
  maxQuantity: number;
  totalAmount: number;
  taxRate: number;
  stockEligible: boolean;
}

export interface FinancialAdviceDocumentProps {
  entityType: 'CUSTOMER' | 'SUPPLIER';
  adviceType?: 'CREDIT';
  clients: Client[];
  suppliers: Supplier[];
  documents: DocumentRecord[];
  onConfirmAdvice: (data: {
    entityType: 'CUSTOMER' | 'SUPPLIER';
    entityId: string;
    documentDate: string;
    targetDocumentId: string;
    reason: string;
    notes: string;
    returnStock: boolean;
    items: { source_line_id: string; quantity: number }[];
  }) => Promise<DocumentRecord | string>;
  onPrintRecord?: (document: DocumentRecord) => void;
}

export const FinancialAdviceDocument: React.FC<FinancialAdviceDocumentProps> = ({
  entityType,
  clients,
  suppliers,
  documents,
  onConfirmAdvice,
  onPrintRecord,
}) => {
  const [entityId, setEntityId] = useState('');
  const [documentDate, setDocumentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceDocumentId, setSourceDocumentId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [returnStock, setReturnStock] = useState(false);
  const [lines, setLines] = useState<CreditLine[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmedDocument, setConfirmedDocument] = useState<DocumentRecord | null>(null);

  const entities = entityType === 'CUSTOMER' ? clients : suppliers;
  const selectedEntity = entities.find((entity) => entity.id === entityId);
  const sourceDocuments = useMemo(() => documents.filter((document) => {
    const validType = entityType === 'CUSTOMER'
      ? ['CUSTOMER_INVOICE', 'CASH_SALE'].includes(document.typeCode)
      : document.typeCode === 'SUPPLIER_INVOICE';
    return document.partyType === entityType
      && document.partyId === entityId
      && validType
      && !['DRAFT', 'CANCELLED', 'REVERSED'].includes(document.status)
      && (document.items?.length || 0) > 0;
  }), [documents, entityId, entityType]);

  const selectedSource = sourceDocuments.find((document) => document.id === sourceDocumentId);

  useEffect(() => {
    const source = sourceDocuments.find((document) => document.id === sourceDocumentId);
    if (!source) {
      setLines([]);
      return;
    }
    setLines((source.items || []).filter((item) => item.documentLineId).map((item) => ({
      sourceLineId: item.documentLineId!,
      code: item.code || 'DIV',
      description: item.description,
      quantity: item.quantity,
      maxQuantity: item.quantity,
      totalAmount: item.total,
      taxRate: item.ivaPercent,
      stockEligible: Boolean(item.stockEffectEnabled && item.lineType === 'STOCK'),
    })));
    setReturnStock(false);
    setError('');
  }, [sourceDocumentId, sourceDocuments]);

  const activeLines = lines.filter((line) => line.quantity > 0);
  const total = activeLines.reduce((sum, line) => sum + line.totalAmount * line.quantity / line.maxQuantity, 0);
  const hasStock = activeLines.some((line) => line.stockEligible);
  const currentBalance = Number(selectedEntity?.pendingBalance || 0);
  const estimatedBalance = currentBalance - total;
  const title = entityType === 'CUSTOMER' ? 'Nota de Crédito a Cliente' : 'Nota de Crédito de Fornecedor';

  const reset = () => {
    setSourceDocumentId(''); setReason(''); setNotes(''); setLines([]); setReturnStock(false);
    setConfirming(false); setConfirmedDocument(null); setError('');
  };

  const executeSave = async () => {
    if (!entityId || !sourceDocumentId || !reason.trim() || activeLines.length === 0) return;
    try {
      setSaving(true); setError('');
      const saved = await onConfirmAdvice({
        entityType, entityId, documentDate, targetDocumentId: sourceDocumentId,
        reason: reason.trim(), notes: notes.trim(), returnStock: returnStock && hasStock,
        items: activeLines.map((line) => ({ source_line_id: line.sourceLineId, quantity: line.quantity })),
      });
      const record = typeof saved === 'string' ? {
        id: saved, displayNumber: 'Nota de crédito confirmada', date: documentDate, dueDate: documentDate,
        typeCode: entityType === 'CUSTOMER' ? 'CUSTOMER_CREDIT_NOTE' : 'SUPPLIER_CREDIT_ADVICE', typeName: title,
        partyType: entityType, partyId: entityId, partyName: selectedEntity?.name || '', status: 'CONFIRMED',
        netTotal: total, taxTotal: 0, grandTotal: total, paidAmount: 0, outstandingAmount: 0,
      } as DocumentRecord : saved;
      record.items = activeLines.map((line) => ({
        documentLineId: line.sourceLineId, articleId: line.sourceLineId, code: line.code,
        description: line.description, quantity: line.quantity, unitPrice: line.totalAmount / line.maxQuantity,
        discountPercent: 0, discountAmount: 0, ivaPercent: line.taxRate,
        total: line.totalAmount * line.quantity / line.maxQuantity,
        lineType: line.stockEligible ? 'STOCK' : 'MANUAL', stockEffectEnabled: returnStock && line.stockEligible,
      }));
      setConfirmedDocument(record); setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao gravar a nota de crédito.');
      setConfirming(false);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        if (confirming) void executeSave();
        else if (!confirmedDocument && entityId && sourceDocumentId && reason.trim() && activeLines.length > 0) setConfirming(true);
      } else if (event.key === 'F5') { event.preventDefault(); reset(); }
      else if (event.key === 'F9' && confirmedDocument && onPrintRecord) { event.preventDefault(); onPrintRecord(confirmedDocument); }
      else if (event.key === 'Escape' && confirming) { event.preventDefault(); setConfirming(false); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [confirming, confirmedDocument, entityId, sourceDocumentId, reason, activeLines, returnStock, notes, documentDate]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#001e40] p-5 text-white">
        <div><p className="text-xs font-black uppercase text-amber-300">Módulo Financeiro — {entityType === 'CUSTOMER' ? 'Clientes' : 'Fornecedores'}</p><h2 className="text-lg font-black uppercase">{title}</h2></div>
        <span className="rounded border border-white/20 bg-white/10 px-4 py-2 font-mono text-xs">Nº: {confirmedDocument?.displayNumber || 'A atribuir'}</span>
      </header>

      <section className="space-y-5 rounded border border-[#c3c6d1] bg-white p-5 dark:border-[#43474f] dark:bg-[#1f2325]">
        {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">{error}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <label><span className="mb-1 block text-xs font-bold uppercase">{entityType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'} *</span><select disabled={Boolean(confirmedDocument)} value={entityId} onChange={(event) => { setEntityId(event.target.value); setSourceDocumentId(''); }} className="w-full rounded border p-2.5 dark:bg-[#282c2e]"><option value="">-- Seleccionar --</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>[{entity.code || entity.number}] {entity.name}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-bold uppercase">Data *</span><input disabled={Boolean(confirmedDocument)} type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} className="w-full rounded border p-2.5 dark:bg-[#282c2e]" /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase">Documento de origem *</span><select disabled={!entityId || Boolean(confirmedDocument)} value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} className="w-full rounded border p-2.5 dark:bg-[#282c2e]"><option value="">-- Seleccionar factura/VD --</option>{sourceDocuments.map((document) => <option key={document.id} value={document.id}>{document.displayNumber} · {formatMZN(document.grandTotal)}</option>)}</select></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="mb-1 block text-xs font-bold uppercase">Motivo *</span><input disabled={Boolean(confirmedDocument)} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: devolução, erro de preço ou abatimento" className="w-full rounded border p-2.5 dark:bg-[#282c2e]" /></label>
          <label><span className="mb-1 block text-xs font-bold uppercase">Observações</span><input disabled={Boolean(confirmedDocument)} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border p-2.5 dark:bg-[#282c2e]" /></label>
        </div>

        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-xs"><thead className="bg-[#e7e8e9] uppercase"><tr><th className="p-3">Código</th><th className="p-3">Linha do documento original</th><th className="p-3 text-center">Quantidade original</th><th className="p-3 text-center">Quantidade a creditar</th><th className="p-3 text-right">Valor a creditar</th></tr></thead><tbody className="divide-y">
            {lines.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Seleccione primeiro o documento de origem. As linhas serão carregadas automaticamente.</td></tr> : lines.map((line) => (
              <tr key={line.sourceLineId}><td className="p-3 font-mono font-bold">{line.code}</td><td className="p-3 font-bold">{line.description}</td><td className="p-3 text-center font-mono">{line.maxQuantity}</td><td className="p-3 text-center"><input disabled={Boolean(confirmedDocument)} type="number" min="0" max={line.maxQuantity} step="0.001" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.sourceLineId === line.sourceLineId ? { ...item, quantity: Math.max(0, Math.min(item.maxQuantity, Number(event.target.value))) } : item))} className="w-24 rounded border p-2 text-center font-mono" /></td><td className="p-3 text-right font-mono font-bold text-[#006e25]">{formatMZN(line.totalAmount * line.quantity / line.maxQuantity)}</td></tr>
            ))}
          </tbody></table>
        </div>

        {hasStock && <label className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900"><input disabled={Boolean(confirmedDocument)} type="checkbox" checked={returnStock} onChange={(event) => setReturnStock(event.target.checked)} />Actualizar também o stock físico ({entityType === 'CUSTOMER' ? 'entrada por devolução do cliente' : 'saída por devolução ao fornecedor'})</label>}

        <div className="grid gap-3 border-t pt-4 md:grid-cols-2"><div className="text-xs"><p>Saldo anterior: <strong>{formatMZN(currentBalance)}</strong></p><p>Novo saldo estimado: <strong className="text-[#006e25]">{formatMZN(estimatedBalance)}</strong></p>{selectedSource && <p className="mt-1 text-slate-500">Origem: {selectedSource.displayNumber}</p>}</div><div className="text-right"><p className="text-xs uppercase text-slate-500">Total da nota de crédito</p><strong className="font-mono text-2xl text-[#006e25]">{formatMZN(total)}</strong></div></div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-xs font-mono text-slate-500">[F2] Confirmar · [F5] Novo · [F9] Imprimir</span><div className="flex gap-2"><button onClick={reset} className="rounded border px-4 py-2 text-xs font-black uppercase">Novo (F5)</button>{confirmedDocument && onPrintRecord ? <button onClick={() => onPrintRecord(confirmedDocument)} className="rounded bg-[#003366] px-4 py-2 text-xs font-black uppercase text-white">Imprimir (F9)</button> : <button disabled={!entityId || !sourceDocumentId || !reason.trim() || activeLines.length === 0 || total <= 0} onClick={() => setConfirming(true)} className="rounded bg-[#006e25] px-5 py-2 text-xs font-black uppercase text-white disabled:opacity-40">Confirmar Nota (F2)</button>}</div></div>
      </section>

      {confirming && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-lg space-y-4 rounded bg-white p-6 shadow-2xl dark:bg-[#1f2325]"><h3 className="font-black uppercase">Confirmar {title}</h3><p className="text-sm">Será emitida uma nota de <strong>{formatMZN(total)}</strong>, ligada a <strong>{selectedSource?.displayNumber}</strong>, reduzindo o saldo de <strong>{selectedEntity?.name}</strong>.</p>{returnStock && hasStock && <p className="rounded bg-blue-50 p-3 text-xs font-bold text-blue-900">O movimento de stock será registado juntamente com a nota.</p>}<div className="flex justify-end gap-2"><button disabled={saving} onClick={() => setConfirming(false)} className="rounded border px-4 py-2 text-xs font-bold uppercase">Voltar</button><button disabled={saving} onClick={() => void executeSave()} className="rounded bg-[#006e25] px-4 py-2 text-xs font-black uppercase text-white">{saving ? 'A gravar…' : 'Confirmar e Gravar (F2)'}</button></div></div></div>}
    </div>
  );
};
