import { createPortal } from 'react-dom';
import type { CompanyProfile, DocumentRecord, PaymentRecord } from '../types';
import { formatMZN } from '../stitch/stitchConfig';
import { PLATFORM_PRODUCT_NAME } from '../lib/branding';

interface PrintRecordModalProps {
  company: CompanyProfile;
  document: DocumentRecord | null;
  payment: PaymentRecord | null;
  onClose: () => void;
}

export function PrintRecordModal({
  company,
  document,
  payment,
  onClose,
}: PrintRecordModalProps) {
  const record = document ?? payment;
  if (!record) return null;

  const number = document?.displayNumber ?? payment?.displayNumber ?? '';
  const title = document
    ? document.typeName || document.typeCode
    : payment?.direction === 'CUSTOMER_RECEIPT'
      ? 'Recibo de Cliente'
      : 'Comprovativo de Pagamento a Fornecedor';
  const partyName = document?.partyName ?? payment?.partyName ?? '';
  const total = document?.grandTotal ?? payment?.totalAmount ?? 0;
  const stockGuideItems = document?.stockGuideItems ?? [];
  const saleItems = document?.items ?? [];

  const handlePrint = () => {
    window.document.body.classList.add('printing-modal');
    window.print();
    setTimeout(() => {
      window.document.body.classList.remove('printing-modal');
    }, 500);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:bg-white print:p-0 print:static print:block print:inset-auto print:backdrop-blur-none print-document-modal">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white text-black shadow-2xl print:shadow-none print:max-w-none print:w-full print:rounded-none print:p-0 print:m-0 print:border-none">
        <div className="flex items-center justify-between bg-[#001e40] px-6 py-3 text-white print:hidden">
          <strong className="text-sm">Visualização de impressão — {number}</strong>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="rounded bg-[#006e25] px-4 py-2 text-xs font-bold">
              Imprimir
            </button>
            <button onClick={onClose} aria-label="Fechar impressão" className="px-2">×</button>
          </div>
        </div>
        <article className="space-y-4 p-6 print:p-0 print:space-y-2.5">
          <header className="flex justify-between border-b-2 border-[#003366] pb-3 print:pb-2">
            <div>
              <h1 className="text-xl print:text-lg font-black uppercase text-[#001e40]">{company.name}</h1>
              <p className="text-xs print:text-[10px] text-gray-600">
                {[company.address, company.city, company.country].filter(Boolean).join(', ')}
              </p>
              {company.taxNumber && <p className="text-xs print:text-[10px] text-gray-600">NUIT: {company.taxNumber}</p>}
              <p className="text-xs print:text-[10px] text-gray-600">
                {[company.phone, company.email].filter(Boolean).join(' • ')}
              </p>
            </div>
            <div className="text-right">
              <span className="rounded bg-[#001e40] px-2.5 py-0.5 text-xs font-bold text-white">{title}</span>
              <p className="mt-1 font-mono font-bold text-xs print:text-[11px]">{number}</p>
              <p className="text-xs print:text-[10px] text-gray-600">Data: {record.date}</p>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-2 rounded border bg-gray-50 p-3 print:p-2 text-xs print:text-[10px] sm:grid-cols-2">
            <div>
              <span className="block text-[10px] print:text-[9px] font-bold uppercase text-gray-500">Entidade</span>
              <strong>{partyName}</strong>
              {document && <p className="text-xs print:text-[10px] text-gray-600">{document.partyType === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'}</p>}
            </div>
            <div className="text-right">
              <span className="block text-[10px] print:text-[9px] font-bold uppercase text-gray-500">Estado</span>
              <strong>{document?.status ?? payment?.status}</strong>
            </div>
          </section>

          {stockGuideItems.length > 0 && (
            <section className="overflow-hidden rounded border text-xs print:text-[9px]">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 font-bold uppercase text-gray-700">
                  <tr>
                    <th className="border px-2 py-1 text-left">Codigo</th>
                    <th className="border px-2 py-1 text-left">Descricao</th>
                    <th className="border px-2 py-1 text-right">Qtd.</th>
                    <th className="border px-2 py-1 text-right">Custo</th>
                    <th className="border px-2 py-1 text-right">Preco venda c/ IVA</th>
                    <th className="border px-2 py-1 text-right">Total custo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockGuideItems.map((item, index) => (
                    <tr key={`${item.articleId}-${index}`}>
                      <td className="border px-2 py-1 font-mono font-bold">{item.articleCode}</td>
                      <td className="border px-2 py-1">{item.articleDescription}</td>
                      <td className="border px-2 py-1 text-right font-mono">{item.quantity}</td>
                      <td className="border px-2 py-1 text-right font-mono">{item.unitCost != null ? formatMZN(item.unitCost) : '-'}</td>
                      <td className="border px-2 py-1 text-right font-mono">{item.salePriceWithIva != null ? formatMZN(item.salePriceWithIva) : '-'}</td>
                      <td className="border px-2 py-1 text-right font-mono">{formatMZN(item.quantity * (item.unitCost ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {stockGuideItems.length === 0 && saleItems.length > 0 && (
            <section className="overflow-hidden rounded border text-xs print:text-[9px]">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 font-bold uppercase text-gray-700">
                  <tr>
                    <th className="border px-2 py-1 text-left">Codigo</th>
                    <th className="border px-2 py-1 text-left">Descricao</th>
                    <th className="border px-2 py-1 text-right">Qtd.</th>
                    <th className="border px-2 py-1 text-right">Preco</th>
                    <th className="border px-2 py-1 text-right">Desc.</th>
                    <th className="border px-2 py-1 text-right">IVA</th>
                    <th className="border px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item, index) => (
                    <tr key={`${item.articleId}-${index}`}>
                      <td className="border px-2 py-1 font-mono font-bold">{item.code}</td>
                      <td className="border px-2 py-1">{item.description}</td>
                      <td className="border px-2 py-1 text-right font-mono">{item.quantity}</td>
                      <td className="border px-2 py-1 text-right font-mono">{formatMZN(item.unitPrice)}</td>
                      <td className="border px-2 py-1 text-right font-mono">{formatMZN(item.discountAmount ?? 0)}</td>
                      <td className="border px-2 py-1 text-right font-mono">{item.ivaPercent}%</td>
                      <td className="border px-2 py-1 text-right font-mono">{formatMZN(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="ml-auto w-full max-w-sm space-y-1 border-t pt-3 print:pt-2 text-xs print:text-[11px] font-mono">
            <div className="flex justify-between text-sm print:text-xs font-black">
              <span>Total</span><span>{formatMZN(total)}</span>
            </div>
            {document && (
              <>
                <div className="flex justify-between text-gray-700"><span>Pago</span><span>{formatMZN(document.paidAmount)}</span></div>
                <div className="flex justify-between text-red-600 font-bold"><span>Pendente</span><span>{formatMZN(document.outstandingAmount)}</span></div>
              </>
            )}
            {payment && (
              <>
                <div className="flex justify-between text-gray-700"><span>Alocado</span><span>{formatMZN(payment.allocatedAmount)}</span></div>
                <div className="flex justify-between text-gray-700"><span>Não aplicado</span><span>{formatMZN(payment.unappliedAmount)}</span></div>
              </>
            )}
          </section>

          <footer className="border-t pt-2 text-center text-[9px] print:text-[8px] text-gray-500">
            Documento emitido pelo {PLATFORM_PRODUCT_NAME}. Conserve para reconciliação.
          </footer>
        </article>
      </div>
    </div>,
    window.document.body
  );
}
