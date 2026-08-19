/**
 * MOVAX ERP / POS - Universal Document & Report Exporter
 * Exports invoices, quotations, stock listings, and accounts to PDF, Excel, and Word.
 */

export interface ExportDataRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ExportDocumentOptions {
  title: string;
  subtitle?: string;
  documentNumber?: string;
  entityName?: string;
  entityNuit?: string;
  date?: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string | number }[];
  currency?: string;
  notes?: string;
  company?: {
    name: string;
    nuit: string;
    address?: string;
    phone?: string;
    email?: string;
    bankDetails?: string;
  };
}

/**
 * 1. Export Data Table as Excel-compatible CSV (.xlsx / .csv)
 */
export function exportToExcel(options: ExportDocumentOptions, filenamePrefix = 'relatorio'): void {
  const currency = options.currency || 'MZN';
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel UTF-8 display

  // Header Title
  csvContent += `"${options.company?.name || 'MOVAX ERP'}"\n`;
  csvContent += `"${options.title} - ${options.documentNumber || ''}"\n`;
  if (options.entityName) csvContent += `"Entidade: ${options.entityName}" - "NUIT: ${options.entityNuit || 'N/A'}"\n`;
  if (options.date) csvContent += `"Data: ${options.date}"\n`;
  csvContent += `\n`;

  // Column Headers
  csvContent += options.headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';') + '\n';

  // Data Rows
  options.rows.forEach((row) => {
    csvContent += row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';') + '\n';
  });

  // Totals Section
  if (options.totals && options.totals.length > 0) {
    csvContent += `\n`;
    options.totals.forEach((t) => {
      csvContent += `;"${t.label}";"${t.value} ${currency}"\n`;
    });
  }

  // Trigger Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `${filenamePrefix}_${options.documentNumber || new Date().toISOString().slice(0, 10)}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 2. Export Document as Microsoft Word (.docx / HTML RTF Document)
 */
export function exportToWord(options: ExportDocumentOptions, filenamePrefix = 'documento'): void {
  const currency = options.currency || 'MZN';

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${options.title}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 30px; }
        h1 { color: #003366; font-size: 20pt; margin-bottom: 4px; }
        .company-header { border-bottom: 2px solid #003366; padding-bottom: 12px; margin-bottom: 20px; }
        .meta-table { width: 100%; margin-bottom: 24px; }
        .meta-table td { padding: 4px; vertical-align: top; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .items-table th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 10pt; }
        .items-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 10pt; }
        .totals-table { width: 40%; margin-left: auto; border-collapse: collapse; }
        .totals-table td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
        .totals-table .grand-total { font-weight: bold; font-size: 13pt; color: #003366; border-top: 2px solid #003366; }
        .footer { margin-top: 40px; font-size: 9pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="company-header">
        <h1>${options.company?.name || 'MOVAX ERP / POS'}</h1>
        <p style="margin:0; font-size:10pt;">NUIT: ${options.company?.nuit || 'N/A'} | ${options.company?.address || 'Moçambique'}</p>
        <p style="margin:0; font-size:10pt;">Tel: ${options.company?.phone || ''} | Email: ${options.company?.email || ''}</p>
      </div>

      <table class="meta-table">
        <tr>
          <td>
            <strong>Documento:</strong> ${options.title}<br/>
            <strong>Número:</strong> ${options.documentNumber || 'PROPOSTA'}<br/>
            <strong>Data de Emissão:</strong> ${options.date || new Date().toLocaleDateString('pt-MZ')}
          </td>
          <td>
            <strong>Exmo.(s) Sr.(s):</strong><br/>
            <strong>${options.entityName || 'Cliente Pontual'}</strong><br/>
            <span>NUIT: ${options.entityNuit || 'Consumidor Final'}</span>
          </td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            ${options.headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${options.rows
            .map(
              (row) => `
            <tr>
              ${row.map((c) => `<td>${c}</td>`).join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      ${
        options.totals
          ? `
        <table class="totals-table">
          ${options.totals
            .map(
              (t, i) => `
            <tr class="${i === options.totals!.length - 1 ? 'grand-total' : ''}">
              <td>${t.label}</td>
              <td style="text-align:right;">${t.value} ${currency}</td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
          : ''
      }

      ${options.notes ? `<div style="margin-top:20px; font-size:10pt; background:#f8fafc; padding:12px; border-left:4px solid #003366;"><strong>Observações:</strong><br/>${options.notes}</div>` : ''}

      <div class="footer">
        <p>Processado por computador • ${options.company?.name || 'Movax ERP Cloud'} • Documento para fins comerciais</p>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `${filenamePrefix}_${options.documentNumber || new Date().toISOString().slice(0, 10)}.doc`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 3. Print / Export to PDF (Native High-Fidelity Printable Window)
 */
export function exportToPdf(options: ExportDocumentOptions): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const currency = options.currency || 'MZN';
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>${options.title} - ${options.documentNumber || ''}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #0f172a; font-size: 12px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #003366; padding-bottom: 15px; margin-bottom: 20px; }
        .company-name { font-size: 22px; font-weight: 900; color: #003366; text-transform: uppercase; }
        .doc-title { text-align: right; }
        .doc-title h2 { margin: 0; font-size: 18px; color: #003366; }
        .doc-num { font-size: 14px; font-weight: bold; color: #475569; margin-top: 4px; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; padding: 12px; background: #f8fafc; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #003366; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .totals-section { display: flex; justify-content: flex-end; margin-top: 15px; }
        .totals-box { width: 300px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fafafa; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .grand-total { font-weight: 900; font-size: 14px; color: #003366; border-top: 2px solid #003366; padding-top: 6px; margin-top: 4px; }
        .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">${options.company?.name || 'MOVAX ERP'}</div>
          <div>NUIT: ${options.company?.nuit || 'N/A'}</div>
          <div>${options.company?.address || 'Maputo, Moçambique'}</div>
          <div>${options.company?.phone || ''} • ${options.company?.email || ''}</div>
        </div>
        <div class="doc-title">
          <h2>${options.title}</h2>
          <div class="doc-num">${options.documentNumber || 'DOCUMENTO FISCAL'}</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Data: ${options.date || new Date().toISOString().slice(0, 10)}</div>
        </div>
      </div>

      <div class="parties">
        <div>
          <strong style="color:#003366; text-transform:uppercase; font-size:10px;">Emitido Por:</strong><br/>
          <strong>${options.company?.name || 'Empresa Emissora'}</strong><br/>
          <span>Maputo, Moçambique</span>
        </div>
        <div>
          <strong style="color:#003366; text-transform:uppercase; font-size:10px;">Exmo.(s) Sr.(s):</strong><br/>
          <strong style="font-size:13px;">${options.entityName || 'Cliente Pontual / Consumidor Final'}</strong><br/>
          <span>NUIT: ${options.entityNuit || '999999999'}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            ${options.headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${options.rows
            .map(
              (row) => `
            <tr>
              ${row.map((c) => `<td>${c}</td>`).join('')}
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      ${
        options.totals
          ? `
        <div class="totals-section">
          <div class="totals-box">
            ${options.totals
              .map(
                (t, idx) => `
              <div class="totals-row ${idx === options.totals!.length - 1 ? 'grand-total' : ''}">
                <span>${t.label}:</span>
                <span>${t.value} ${currency}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      ${options.notes ? `<div style="margin-top:20px; font-size:11px; padding:10px; background:#f1f5f9; border-radius:6px;"><strong>Observações:</strong> ${options.notes}</div>` : ''}

      <div class="footer">
        Documento processado por computador • ${options.company?.name || 'Movax ERP Cloud'} • Software de Gestão Certificado Moçambique
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
