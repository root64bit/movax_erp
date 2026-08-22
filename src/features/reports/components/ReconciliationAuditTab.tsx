import React, { useState, useMemo, useEffect } from 'react';
import type { SaleInvoice } from '@/shared/types/domain.types';
import { formatMZN } from '@/shared/utils/formatters';

export interface ReconciliationAuditTabProps {
  sales: SaleInvoice[];
}

interface ShadowRecord {
  id: string;
  docNum: string;
  docType: string;
  date: string;
  clientName: string;
  clientNuit: string;
  paymentMode: string;
  gross: number;
  tax: number;
  total: number;
  channel: 'OFFICIAL' | 'SHADOW';
}

export const ReconciliationAuditTab: React.FC<ReconciliationAuditTabProps> = ({ sales }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'OFFICIAL' | 'SHADOW'>('ALL');
  const [isScanning, setIsScanning] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [shadowDb, setShadowDb] = useState<ShadowRecord[]>(() => {
    try {
      const saved = localStorage.getItem('movax_sim_db_oculta');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Combine real official sales from ERP state with shadow records
  const consolidatedRecords = useMemo(() => {
    const officialRecords: ShadowRecord[] = sales
      .filter((s) => s.status !== 'Cancelada' && s.documentTypeCode !== 'CUSTOMER_DELIVERY_NOTE')
      .map((s) => ({
        id: s.id,
        docNum: s.docNumber || 'FT 2026/0000',
        docType: s.documentTypeCode || 'CUSTOMER_INVOICE',
        date: s.date ? new Date(s.date).toLocaleDateString('pt-MZ') : new Date().toLocaleDateString('pt-MZ'),
        clientName: s.clientName || 'Cliente Pontual',
        clientNuit: s.clientNuit || '999999999',
        paymentMode: s.paymentMethod || 'Numerário',
        gross: s.subtotalBruto || s.totalAmount || 0,
        tax: s.ivaTotal || (s.totalAmount ? s.totalAmount * 0.16 : 0),
        total: s.totalAmount || 0,
        channel: 'OFFICIAL' as const,
      }));

    return [...officialRecords, ...shadowDb];
  }, [sales, shadowDb]);

  // Financial Metrics
  const metrics = useMemo(() => {
    let officialTotal = 0;
    let officialTax = 0;
    let officialCount = 0;

    let shadowTotal = 0;
    let shadowTax = 0;
    let shadowCount = 0;

    consolidatedRecords.forEach((r) => {
      if (r.channel === 'OFFICIAL') {
        officialTotal += r.total;
        officialTax += r.tax;
        officialCount += 1;
      } else {
        shadowTotal += r.total;
        shadowTax += r.tax;
        shadowCount += 1;
      }
    });

    const realTotalRevenue = officialTotal + shadowTotal;
    const omissionRate = realTotalRevenue > 0 ? (shadowTotal / realTotalRevenue) * 100 : 0;

    return {
      officialTotal,
      officialTax,
      officialCount,
      shadowTotal,
      shadowTax,
      shadowCount,
      realTotalRevenue,
      omissionRate,
    };
  }, [consolidatedRecords]);

  // Filtered Table Records
  const filteredRecords = useMemo(() => {
    if (filterType === 'OFFICIAL') return consolidatedRecords.filter((r) => r.channel === 'OFFICIAL');
    if (filterType === 'SHADOW') return consolidatedRecords.filter((r) => r.channel === 'SHADOW');
    return consolidatedRecords;
  }, [consolidatedRecords, filterType]);

  // Preload Demo Data
  const handleLoadDemo = () => {
    const demoShadow: ShadowRecord[] = [
      {
        id: 'shd-demo-1',
        docNum: 'VD 2026/0014',
        docType: 'CASH_SALE',
        date: new Date().toLocaleDateString('pt-MZ'),
        clientName: 'Cliente Pontual / Balcão',
        clientNuit: '999999999',
        paymentMode: 'Dinheiro (Numerário)',
        gross: 18400,
        tax: 2944,
        total: 21344,
        channel: 'SHADOW',
      },
      {
        id: 'shd-demo-2',
        docNum: 'VD 2026/0015',
        docType: 'CASH_SALE',
        date: new Date().toLocaleDateString('pt-MZ'),
        clientName: 'Cliente Balcão Particular',
        clientNuit: '999999999',
        paymentMode: 'Dinheiro (Numerário)',
        gross: 3800,
        tax: 608,
        total: 4408,
        channel: 'SHADOW',
      },
    ];

    setShadowDb(demoShadow);
    try {
      localStorage.setItem('movax_sim_db_oculta', JSON.stringify(demoShadow));
    } catch {}
  };

  const handleClearShadow = () => {
    setShadowDb([]);
    try {
      localStorage.removeItem('movax_sim_db_oculta');
    } catch {}
  };

  // Run Forensic Audit Scan
  const handleRunForensicScan = () => {
    setIsScanning(true);
    setDiagnosticLogs([
      'Iniciando rotina de auditoria heurística da AT Moçambique...',
      'Analisando coerência de séries fiscais e numeração de documentos...',
    ]);

    setTimeout(() => {
      setDiagnosticLogs((prev) => [
        ...prev,
        `Vetor 1 (Séries Fiscais): ${metrics.officialCount} documentos oficiais auditados com assinatura contínua.`,
        'Analisando divergências de conciliação de numerário e M-Pesa...',
      ]);
    }, 600);

    setTimeout(() => {
      setDiagnosticLogs((prev) => [
        ...prev,
        `Vetor 2 (Fluxo de Caixa): Detectadas ${metrics.shadowCount} transações em numerário sem registo no mapa M/04 oficial.`,
        `Vetor 3 (Impacto Tributário): IVA omitido estimado: ${formatMZN(metrics.shadowTax)}.`,
        `Conclusão: Taxa de Omissão Fiscal calculada em ${metrics.omissionRate.toFixed(1)}%.`,
      ]);
      setIsScanning(false);
    }, 1300);
  };

  // CSV Export
  const handleExportAuditCSV = () => {
    const headers = ['Canal', 'NumDoc', 'Tipo', 'Data', 'Cliente', 'NUIT', 'Pagamento', 'Iliquido', 'IVA', 'Total'];
    const rows = consolidatedRecords.map((r) => [
      r.channel,
      r.docNum,
      r.docType,
      r.date,
      `"${r.clientName.replace(/"/g, '""')}"`,
      r.clientNuit,
      r.paymentMode,
      r.gross.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
    ]);

    const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_reconciliacao_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Actions */}
      <section className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 p-5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-2xl text-purple-600">shield</span>
            <h2 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100">
              Painel de Reconciliação Financeira & Auditoria
            </h2>
            <span className="bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
              Visão do Gestor
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciliação e consolidação entre a contabilidade oficial declarada à AT e a receita real do negócio.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleLoadDemo}
            className="px-3 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 rounded-xl font-bold text-xs hover:bg-purple-100 dark:hover:bg-purple-900/50 transition flex items-center space-x-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-base">science</span>
            <span>Carregar Dados de Exemplo</span>
          </button>
          <button
            type="button"
            onClick={handleClearShadow}
            className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/50 transition flex items-center space-x-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            <span>Limpar Sombra</span>
          </button>
          <button
            type="button"
            onClick={handleExportAuditCSV}
            className="px-3 py-2 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar Auditoria</span>
          </button>
        </div>
      </section>

      {/* 2. Key Metric Cards Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Declared Revenue (Official A) */}
        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Declarado Oficial (A)</span>
            <span className="material-symbols-outlined text-xl">account_balance</span>
          </div>
          <div className="text-lg font-black text-emerald-600 font-mono">
            {formatMZN(metrics.officialTotal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.officialCount} documento(s) no M/04
          </div>
        </div>

        {/* Hidden Revenue (Shadow B) */}
        <div className="bg-surface dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded-2xl p-4 shadow-xs bg-purple-50/20 dark:bg-purple-950/10">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-bold uppercase text-purple-700 dark:text-purple-300">Ocultado / Caixa (B)</span>
            <span className="material-symbols-outlined text-xl">visibility_off</span>
          </div>
          <div className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono">
            {formatMZN(metrics.shadowTotal)}
          </div>
          <div className="text-[11px] text-purple-500 mt-1">
            {metrics.shadowCount} venda(s) paralela(s)
          </div>
        </div>

        {/* Real Consolidated Revenue (A + B) */}
        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Receita Real (A + B)</span>
            <span className="material-symbols-outlined text-xl">savings</span>
          </div>
          <div className="text-lg font-black text-blue-600 font-mono">
            {formatMZN(metrics.realTotalRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {consolidatedRecords.length} transações globais
          </div>
        </div>

        {/* Fiscal Omission Rate */}
        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">Taxa de Omissão</span>
            <span className="material-symbols-outlined text-xl">warning</span>
          </div>
          <div className="text-lg font-black text-rose-600 font-mono">
            {metrics.omissionRate.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.omissionRate)}%` }}
            />
          </div>
        </div>

        {/* Evaded VAT */}
        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase text-slate-500">IVA Omitido (16%)</span>
            <span className="material-symbols-outlined text-xl">policy</span>
          </div>
          <div className="text-lg font-black text-amber-600 font-mono">
            {formatMZN(metrics.shadowTax)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Estimativa de imposto retido
          </div>
        </div>
      </div>

      {/* 3. Forensic Diagnostic Scanner */}
      <section className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-xl text-amber-600">troubleshoot</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
              Motor de Diagnóstico Forense da AT Moçambique
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRunForensicScan}
            disabled={isScanning}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">search</span>
            <span>{isScanning ? 'A Executar Varredura...' : 'Executar Diagnóstico Forense'}</span>
          </button>
        </div>

        <div className="bg-slate-950 text-emerald-400 border border-slate-800 rounded-xl p-3.5 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
          {diagnosticLogs.length === 0 ? (
            <div className="text-slate-500">
              &gt; Motor de auditoria pronto. Clique em &quot;Executar Diagnóstico Forense&quot; para analisar o padrão de vendas e faturas.
            </div>
          ) : (
            diagnosticLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                &gt; {log}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Consolidated Transaction Ledger */}
      <section className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-outline-variant dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">
              Livro Geral de Transações Reconciliadas
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Listagem comparativa de documentos fiscais e vendas em numerário não declaradas.
            </p>
          </div>

          <div className="flex items-center bg-white dark:bg-slate-900 border border-outline-variant dark:border-slate-700 rounded-xl p-1 space-x-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterType === 'ALL'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todas ({consolidatedRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('OFFICIAL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterType === 'OFFICIAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Oficiais ({metrics.officialCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('SHADOW')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                filterType === 'SHADOW'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Ocultadas ({metrics.shadowCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold border-b border-outline-variant dark:border-slate-800">
              <tr>
                <th className="p-3">Canal</th>
                <th className="p-3">Nº Documento</th>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">NUIT</th>
                <th className="p-3">Meio de Pagamento</th>
                <th className="p-3 text-right">IVA (16%)</th>
                <th className="p-3 text-right">Total (MT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant dark:divide-slate-800 font-mono">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                    Nenhuma transação registada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isShadow = record.channel === 'SHADOW';
                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        isShadow ? 'bg-purple-50/20 dark:bg-purple-950/10' : ''
                      }`}
                    >
                      <td className="p-3">
                        {isShadow ? (
                          <span className="bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                            ● SOMBRA (B)
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                            ● OFICIAL (A)
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-3 font-bold ${
                          isShadow ? 'text-purple-700 dark:text-purple-400' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {record.docNum}
                      </td>
                      <td className="p-3 text-slate-500 font-sans">{record.date}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200 font-sans">
                        {record.clientName}
                      </td>
                      <td className="p-3 text-slate-500">{record.clientNuit}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-sans">{record.paymentMode}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                        {formatMZN(record.tax)}
                      </td>
                      <td
                        className={`p-3 text-right font-bold text-sm ${
                          isShadow ? 'text-purple-600 dark:text-purple-400' : 'text-emerald-600'
                        }`}
                      >
                        {formatMZN(record.total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
