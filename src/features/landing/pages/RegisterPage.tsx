import React, { useState, useEffect } from 'react';
import { DEFAULT_SUBSCRIPTION_PLANS, OnboardingService } from '../services/onboarding.service';
import type { SubscriptionPlanCode, TenantOnboardingInput } from '@/shared/types/domain.types';

interface RegisterPageProps {
  onNavigate?: (route: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [step, setStep] = useState(1);

  // Step 1: Empresa
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [city, setCity] = useState('Maputo');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [currency] = useState('MZN');

  // Step 2: Administrador
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3: Plano & Ciclo
  const [planCode, setPlanCode] = useState<SubscriptionPlanCode>('BUSINESS');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  // Step 4: Pagamento
  const [paymentMethod, setPaymentMethod] = useState<'M_PESA' | 'BANK_TRANSFER'>('M_PESA');
  const [mpesaNumber, setMpesaNumber] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan') as SubscriptionPlanCode;
    const cycleParam = params.get('cycle') as 'MONTHLY' | 'ANNUAL';
    if (planParam && ['STARTER', 'BUSINESS', 'PRO', 'ENTERPRISE'].includes(planParam)) {
      setPlanCode(planParam);
    }
    if (cycleParam && ['MONTHLY', 'ANNUAL'].includes(cycleParam)) {
      setBillingCycle(cycleParam);
    }
  }, []);

  const handleNav = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const selectedPlanObj = DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === planCode) || DEFAULT_SUBSCRIPTION_PLANS[1];
  const priceDue = billingCycle === 'ANNUAL' ? selectedPlanObj.priceAnnual : selectedPlanObj.priceMonthly;

  const validateStep1 = () => {
    if (!companyName.trim()) {
      setError('Por favor introduza o nome legal da empresa.');
      return false;
    }
    if (!taxNumber.trim() || taxNumber.trim().length < 9) {
      setError('Por favor introduza um NUIT válido de 9 dígitos.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!adminFullName.trim()) {
      setError('Por favor introduza o nome completo do administrador.');
      return false;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      setError('Por favor introduza um email profissional válido.');
      return false;
    }
    if (adminPassword.length < 8) {
      setError('A palavra-passe deve conter no mínimo 8 caracteres.');
      return false;
    }
    if (adminPassword !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep4 = () => {
    if (paymentMethod === 'M_PESA') {
      const cleanPhone = mpesaNumber.replace(/\D/g, '');
      if (cleanPhone.length < 9) {
        setError('Introduza um número M-Pesa válido de Moçambique (84/85 xxx xxxx).');
        return false;
      }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setError('');
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep4()) return;

    setLoading(true);
    setError('');
    try {
      const payload: TenantOnboardingInput = {
        companyName: companyName.trim(),
        taxNumber: taxNumber.trim(),
        city: city.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        currency,
        adminFullName: adminFullName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword,
        planCode,
        billingCycle,
        paymentMethod,
        mpesaNumber: paymentMethod === 'M_PESA' ? mpesaNumber.trim() : undefined,
      };

      await OnboardingService.provisionTenant(payload);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o registo da empresa.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 grid place-items-center mx-auto">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Registo Concluído!</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A sua empresa <strong className="text-primary">{companyName}</strong> e a conta de administrador foram provisionadas com sucesso no plano <strong className="text-primary">{selectedPlanObj.name}</strong>.
          </p>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 text-left space-y-1.5">
            <p><strong>Email:</strong> {adminEmail}</p>
            <p><strong>NUIT:</strong> {taxNumber}</p>
            <p><strong>Ciclo:</strong> {billingCycle === 'ANNUAL' ? 'Anual (-15%)' : 'Mensal'}</p>
          </div>
          <button
            onClick={() => handleNav('login')}
            className="w-full py-3.5 bg-primary hover:bg-primary-container text-white font-black rounded-xl shadow-md transition-all"
          >
            Iniciar Sessão no Movax ERP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col justify-between antialiased">
      {/* Top Simple Header */}
      <header className="px-6 py-4 border-b border-outline-variant dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2 font-black text-base text-primary"
        >
          <span className="material-symbols-outlined text-xl">dataset</span>
          <span>MOVAX ERP</span>
        </button>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <span>Já tem conta?</span>
          <button
            type="button"
            onClick={() => handleNav('login')}
            className="font-bold text-primary hover:underline"
          >
            Entrar
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto p-4 sm:p-6 my-auto">
        <div className="bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[580px]">
          {/* Stepper Header */}
          <div className="p-6 border-b border-outline-variant dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-300 z-0"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              ></div>

              {/* Steps */}
              {[
                { s: 1, label: 'Empresa' },
                { s: 2, label: 'Admin' },
                { s: 3, label: 'Plano' },
                { s: 4, label: 'Pagar' },
              ].map(({ s, label }) => {
                const isActive = step >= s;
                const isCurrent = step === s;
                return (
                  <div key={s} className="relative z-10 flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isActive
                          ? 'bg-primary text-white ring-4 ring-primary/20'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {s}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        isCurrent ? 'text-primary' : 'text-slate-500'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 flex-grow flex flex-col justify-between">
            {/* Step 1: Detalhes da Empresa */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Detalhes da Empresa</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Insira os dados legais da sua organização para configurar a conta e as faturas.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Comercial / Razão Social *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Comercial Maputo Lda"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        NUIT (9 dígitos) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={9}
                        placeholder="Ex: 400123456"
                        value={taxNumber}
                        onChange={(e) => setTaxNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cidade / Província *
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                      >
                        <option value="Maputo">Maputo Cidade</option>
                        <option value="Maputo Província">Maputo Província (Matola)</option>
                        <option value="Beira">Beira (Sofala)</option>
                        <option value="Nampula">Nampula</option>
                        <option value="Tete">Tete</option>
                        <option value="Quelimane">Quelimane (Zambézia)</option>
                        <option value="Pemba">Pemba (Cabo Delgado)</option>
                        <option value="Chimoio">Chimoio (Manica)</option>
                        <option value="Inhambane">Inhambane / Maxixe</option>
                        <option value="Xai-Xai">Xai-Xai (Gaza)</option>
                        <option value="Lichinga">Lichinga (Niassa)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Endereço / Bairro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Av. 24 de Julho nº 123"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Contacto Telefónico
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: (+258) 84 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Utilizador Administrador */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Conta do Administrador</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Crie as credenciais mestre de acesso para gerir o ERP, utilizadores e finanças.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo do Gestor *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Alberto"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email de Acesso (Login) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@empresa.co.mz"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Palavra-passe *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Mínimo 8 caracteres"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Confirmar Palavra-passe *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Repita a palavra-passe"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Seleção do Plano & Faturação */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Escolha o seu Plano</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecione o plano e o ciclo de faturação pretendido para o seu negócio.
                  </p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 max-w-xs mx-auto border border-slate-200 dark:border-slate-700 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('MONTHLY')}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      billingCycle === 'MONTHLY'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('ANNUAL')}
                    className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      billingCycle === 'ANNUAL'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>Anual</span>
                    <span className="text-[10px] bg-green-600 text-white px-1.5 rounded-full font-black">-15%</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {DEFAULT_SUBSCRIPTION_PLANS.map((p) => {
                    const isSelected = planCode === p.code;
                    const price = billingCycle === 'ANNUAL' ? Math.round(p.priceAnnual / 12) : p.priceMonthly;

                    return (
                      <div
                        key={p.code}
                        onClick={() => setPlanCode(p.code as SubscriptionPlanCode)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary'
                            : 'border-outline-variant dark:border-slate-800 hover:border-slate-400'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</span>
                            {isSelected && (
                              <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{p.description}</p>
                        </div>
                        <div className="mt-4 pt-2 border-t border-outline-variant/60 flex items-baseline justify-between">
                          <span className="text-base font-black text-primary">
                            {price.toLocaleString('pt-MZ')} MT
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">/mês</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: Pagamento & Ativação */}
            {step === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Pagamento & Ativação</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Liquidação automática e segura do primeiro ciclo da plataforma.
                  </p>
                </div>

                {/* Resumo */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-outline-variant dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Plano {selectedPlanObj.name} ({billingCycle === 'ANNUAL' ? 'Ciclo Anual' : 'Ciclo Mensal'})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {companyName} • NUIT: {taxNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-primary">
                      {priceDue.toLocaleString('pt-MZ')} MT
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Método de Liquidação
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('M_PESA')}
                      className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'M_PESA'
                          ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-500/20'
                          : 'border-outline-variant text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                      <span>M-Pesa (Vodacom)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK_TRANSFER')}
                      className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                          : 'border-outline-variant text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">account_balance</span>
                      <span>Transferência Bancária</span>
                    </button>
                  </div>

                  {paymentMethod === 'M_PESA' && (
                    <div className="pt-2 animate-fadeIn space-y-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Número de Telefone M-Pesa (84/85 xxx xxxx) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Ex: 84 123 4567"
                        value={mpesaNumber}
                        onChange={(e) => setMpesaNumber(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:border-primary focus:outline-none"
                      />
                      <p className="text-[11px] text-slate-500">
                        Receberá uma notificação USSD no telemóvel para autorizar a liquidação com o seu PIN M-Pesa.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'BANK_TRANSFER' && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p><strong>Banco:</strong> BCI Moçambique</p>
                      <p><strong>Conta:</strong> 1234567890</p>
                      <p><strong>NIB:</strong> 0008.0000.1234.5678.9012.3</p>
                      <p className="text-[10px] text-slate-500 pt-1">
                        A conta será ativada e a fatura emitida assim que o comprovativo for reconciliado.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            {/* Step Controls */}
            <div className="pt-6 border-t border-outline-variant dark:border-slate-800 flex items-center justify-between gap-3 mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Voltar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNav('home')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900"
                >
                  Cancelar
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 ml-auto"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60 ml-auto"
                >
                  {loading ? 'A processar...' : 'Concluir e Ativar Empresa'}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 border-t border-outline-variant dark:border-slate-800">
        © {new Date().getFullYear()} Movax ERP. Plataforma empresarial cloud para Moçambique.
      </footer>
    </div>
  );
};
