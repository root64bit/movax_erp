import React, { useState } from 'react';
import type { AddonCatalogItem } from '../services/subscription.service';
import { SubscriptionService } from '../services/subscription.service';

interface AddonCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  addon: AddonCatalogItem | null;
  onCompleted: () => Promise<void>;
}

export const AddonCheckoutModal: React.FC<AddonCheckoutModalProps> = ({
  isOpen,
  onClose,
  addon,
  onCompleted,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'M_PESA' | 'BANK_TRANSFER'>('M_PESA');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  if (!isOpen || !addon) return null;

  const isTechnical = addon.requiresTechnicalSetup;
  const totalAmount = isTechnical ? addon.priceMonthly + addon.setupFee : addon.priceMonthly;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('O ficheiro selecionado é demasiado grande (máximo 10MB).');
        return;
      }
      setReceiptFile(file);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError('O ficheiro selecionado é demasiado grande (máximo 10MB).');
        return;
      }
      setReceiptFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (paymentMethod === 'M_PESA') {
      const cleanPhone = mpesaNumber.replace(/\D/g, '');
      if (cleanPhone.length < 9) {
        setError('Introduza um número M-Pesa válido (84/85 xxx xxxx).');
        return;
      }
    }

    if (isTechnical) {
      if (!contactName.trim() || !contactPhone.trim()) {
        setError('Por favor indique o nome e contacto do responsável para agendamento.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isTechnical) {
        await SubscriptionService.requestTechnicalSetup({
          addonCode: addon.code,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim() || undefined,
          preferredDate: preferredDate || undefined,
          notes: notes.trim() || undefined,
          paymentMethod,
          mpesaNumber: paymentMethod === 'M_PESA' ? mpesaNumber.trim() : undefined,
          bankReference: paymentMethod === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
          receiptFileName: paymentMethod === 'BANK_TRANSFER' && receiptFile ? receiptFile.name : undefined,
        });

        setSuccessNotice(
          'Pedido registado com sucesso! A nossa equipa técnica entrará em contacto em menos de 24h para agendar a configuração.',
        );
      } else {
        await SubscriptionService.activateInstantAddon(
          addon.code,
          paymentMethod,
          paymentMethod === 'M_PESA' ? mpesaNumber.trim() : undefined,
          paymentMethod === 'BANK_TRANSFER' ? bankReference.trim() : undefined,
          paymentMethod === 'BANK_TRANSFER' && receiptFile ? receiptFile.name : undefined,
        );

        setSuccessNotice(`Módulo ${addon.name} ativado com sucesso! As funcionalidades já estão disponíveis.`);
      }

      await onCompleted();
      setTimeout(() => {
        setSuccessNotice('');
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Falha ao processar a solicitação do módulo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-0.5 rounded-full">
                {addon.category}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isTechnical
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {isTechnical ? '🛠️ Requer Equipa Técnica' : '⚡ Ativação Instantânea'}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{addon.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{addon.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {successNotice ? (
            <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 space-y-2 text-center py-8">
              <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
              <h4 className="font-black text-sm">Solicitação Concluída!</h4>
              <p className="text-xs leading-relaxed max-w-md mx-auto font-medium">{successNotice}</p>
            </div>
          ) : (
            <>
              {/* Pricing breakdown */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Subscrição Mensal:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {addon.priceMonthly.toLocaleString('pt-MZ')} MT / mês
                  </span>
                </div>
                {isTechnical && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Taxa de Configuração & Setup Técnico:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {addon.setupFee.toLocaleString('pt-MZ')} MT (Taxa Única)
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-black text-sm text-primary dark:text-primary-fixed-dim">
                  <span>Total Inicial a Faturar:</span>
                  <span>{totalAmount.toLocaleString('pt-MZ')} MT</span>
                </div>
              </div>

              {/* Technical scope banner */}
              {isTechnical && addon.technicalScope && (
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                    <span className="material-symbols-outlined text-base">engineering</span>
                    <span>Escopo da Intervenção Técnica:</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                    {addon.technicalScope}
                  </p>
                </div>
              )}

              {/* Contact info for technical setup */}
              {isTechnical && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Dados do Responsável para Agendamento Técnico
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Nome do Responsável *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: João Manhiça"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Contacto Telefónico / WhatsApp *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: (+258) 84 123 4567"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Email Corporativo
                      </label>
                      <input
                        type="email"
                        placeholder="ti@empresa.co.mz"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Data Preferencial de Contacto
                      </label>
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Observações / Detalhes de Integração
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Precisamos de integrar com o nosso WooCommerce e balanças Toledo na loja de Maputo."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                    ></textarea>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">Método de Pagamento</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('M_PESA')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'M_PESA'
                        ? 'border-red-600 bg-red-50/60 dark:bg-red-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-red-600 flex items-center justify-center">
                        {paymentMethod === 'M_PESA' && <span className="h-1.5 w-1.5 rounded-full bg-red-600"></span>}
                      </span>
                      <span className="font-black text-red-600 text-xs">M-Pesa</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 pl-5">Débito no telemóvel imediato</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'border-primary bg-primary/5 dark:bg-primary/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border border-primary flex items-center justify-center">
                        {paymentMethod === 'BANK_TRANSFER' && <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>}
                      </span>
                      <span className="font-black text-primary text-xs">Transferência Bancária</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 pl-5">BIM / BCI / Standard Bank</p>
                  </button>
                </div>

                {paymentMethod === 'M_PESA' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Número M-Pesa para Pagamento *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="84 / 85 XXX XXXX"
                      value={mpesaNumber}
                      onChange={(e) => setMpesaNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Coordenadas para Pagamento:</p>
                      <p className="text-slate-600 dark:text-slate-400">
                        • <strong>Millennium BIM</strong>: Conta 123456789 | NIB: 0001 0000 1234 5678 9012 3
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        • <strong>BCI</strong>: Conta 987654321 | NIB: 0008 0000 9876 5432 1098 7
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        • <strong>Standard Bank</strong>: Conta 555666777 | NIB: 0003 0000 5556 6677 7012 3
                      </p>
                      <p className="text-[10px] text-slate-500 italic mt-1">
                        Indique o NUIT da sua empresa como descritivo da transferência.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Nº de Referência / Talão de Depósito (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: TRF-982341 ou Nº do Talão"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Comprovativo de Pagamento Bancário
                      </label>
                      {receiptFile ? (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <span className="material-symbols-outlined text-emerald-600 text-lg">receipt_long</span>
                            <div className="truncate">
                              <p className="font-bold truncate">{receiptFile.name}</p>
                              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                                {(receiptFile.size / 1024).toFixed(1)} KB • Comprovativo anexado com sucesso
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReceiptFile(null)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Remover comprovativo"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      ) : (
                        <label
                          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleDrop}
                          className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center group ${
                            isDragging
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-300 dark:border-slate-700 hover:border-primary bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/70'
                          }`}
                        >
                          <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors mb-1">
                            upload_file
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-xs group-hover:text-primary transition-colors">
                            Carregar Comprovativo de Pagamento / Recibo do Banco
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            PDF, PNG, JPG ou JPEG (máx. 10MB) ou clique para procurar
                          </span>
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/jpg"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold">{error}</p>}

              {/* Submit Action */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-2 py-3 bg-primary hover:bg-primary-container text-white font-black rounded-xl shadow-md text-xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>A processar…</span>
                    </>
                  ) : isTechnical ? (
                    <>
                      <span className="material-symbols-outlined text-base">support_agent</span>
                      <span>Solicitar Setup & Confirmar Pagamento</span>
                    </>
                  ) : paymentMethod === 'BANK_TRANSFER' ? (
                    <>
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      <span>Submeter Comprovativo & Ativar</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">bolt</span>
                      <span>Confirmar Pagamento & Ativar Imediatamente</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
