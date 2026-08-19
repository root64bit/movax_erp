import React, { useEffect, useMemo, useState } from 'react';
import type { CompanyProfile, UserSummary, BankAccount } from '@/shared/types/domain.types';
import {
  RESPONSIBILITY_BUNDLES,
  ADVANCED_OVERRIDE_PERMISSIONS,
  calculateEffectivePermissions,
  calculateBusinessCapabilities,
  getBundleByCode,
  type ResponsibilityBundle,
} from '@/lib/responsibilityBundles';

import { LicenseManagementPage } from '@/features/subscriptions';

interface AdministrationProps {
  systemMode: string;
  users: UserSummary[];
  permissions: string[];
  company?: CompanyProfile;
  onUpdateUser: (user: UserSummary, active: boolean, newBundles?: string[], newPermissions?: string[], newPassword?: string) => Promise<void>;
  onCreateUser?: (userData: {
    fullName: string;
    email: string;
    password?: string;
    bundles: string[];
    permissions: string[];
    telephone?: string;
  }) => Promise<void>;
  onSaveCompanySettings?: (settings: {
    bankBciAccount: string;
    bankBciNib: string;
    bankBimAccount: string;
    bankBimNib: string;
    bankAccounts: BankAccount[];
    quotationValidityDays: string;
    quotationDefaultNotes: string;
  }) => Promise<void>;
}

export function Administration({
  systemMode,
  users,
  permissions,
  company,
  onUpdateUser,
  onCreateUser,
  onSaveCompanySettings,
}: AdministrationProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [bundleFilter, setBundleFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);

  // Company Settings State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(
    company?.bankAccounts?.length ? company.bankAccounts : []
  );
  const [validityDays, setValidityDays] = useState(company?.quotationValidityDays || '7 dias');
  const [defaultNotes, setDefaultNotes] = useState(company?.quotationDefaultNotes || '');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setBankAccounts(company.bankAccounts ?? []);
      if (company.quotationValidityDays) setValidityDays(company.quotationValidityDays);
      if (company.quotationDefaultNotes) setDefaultNotes(company.quotationDefaultNotes);
    }
  }, [company]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCompanySettings) return;
    setSettingsSaving(true);
    setSettingsSuccess('');
    try {
      await onSaveCompanySettings({
        bankBciAccount: bankAccounts[0]?.account || '',
        bankBciNib: bankAccounts[0]?.nib || '',
        bankBimAccount: bankAccounts[1]?.account || '',
        bankBimNib: bankAccounts[1]?.nib || '',
        bankAccounts,
        quotationValidityDays: validityDays,
        quotationDefaultNotes: defaultNotes,
      });
      setSettingsSuccess('Configurações de Cotações salvas permanentemente com sucesso!');
      setTimeout(() => setSettingsSuccess(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telephone, setTelephone] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<string[]>(['VENDAS_CAIXA']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customAdditions, setCustomAdditions] = useState<string[]>([]);
  const [customRemovals, setCustomRemovals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isModalOpen]);

  // Calculate live capabilities for modal
  const capabilities = useMemo(() => {
    return calculateBusinessCapabilities(selectedBundles, customAdditions, customRemovals);
  }, [selectedBundles, customAdditions, customRemovals]);

  // Effective permissions preview
  const effectivePermissionsPreview = useMemo(() => {
    return calculateEffectivePermissions(selectedBundles, customAdditions, customRemovals);
  }, [selectedBundles, customAdditions, customRemovals]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setTelephone('');
    setSelectedBundles(['VENDAS_CAIXA']);
    setCustomAdditions([]);
    setCustomRemovals([]);
    setShowAdvanced(false);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (user: UserSummary) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPassword('');
    setTelephone(user.telephone || '');
    setSelectedBundles(user.bundles && user.bundles.length > 0 ? user.bundles : user.roles.length > 0 ? user.roles : ['VENDAS_CAIXA']);
    setCustomAdditions([]);
    setCustomRemovals([]);
    setShowAdvanced(false);
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  // Toggle Bundle Checkbox
  const handleToggleBundle = (code: string) => {
    setSelectedBundles((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // Keep at least one bundle
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  // Toggle Override Permission
  const handleToggleAddition = (permCode: string) => {
    setCustomAdditions((prev) =>
      prev.includes(permCode) ? prev.filter((p) => p !== permCode) : [...prev, permCode]
    );
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!fullName.trim()) {
      setFormError('Por favor introduza o nome completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Por favor introduza um email válido.');
      return;
    }
    if (!editingUser && (!password || password.length < 6)) {
      setFormError('Por favor introduza uma palavra-passe inicial com pelo menos 6 caracteres.');
      return;
    }
    if (selectedBundles.length === 0) {
      setFormError('Por favor selecione pelo menos um Pacote de Responsabilidades.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        // Protect Last Active Administrator
        const activeAdmins = users.filter(
          (u) => u.active && (u.roles.includes('ADMIN') || (u.bundles && u.bundles.includes('ADMIN')))
        );
        const isEditingLastAdmin =
          activeAdmins.length === 1 &&
          activeAdmins[0].id === editingUser.id &&
          !selectedBundles.includes('ADMIN');

        if (isEditingLastAdmin) {
          throw new Error('Não é possível remover a função de Administrador do único Administrador ativo no sistema.');
        }

        await onUpdateUser(
          { ...editingUser, fullName, email, telephone },
          editingUser.active,
          selectedBundles,
          effectivePermissionsPreview,
          password.trim() || undefined
        );
        setFormSuccess('Utilizador e pacotes de responsabilidades atualizados com sucesso!');
      } else if (onCreateUser) {
        await onCreateUser({
          fullName,
          email,
          password,
          bundles: selectedBundles,
          permissions: effectivePermissionsPreview,
          telephone,
        });
        setFormSuccess('Novo utilizador criado com sucesso! As credenciais foram ativadas.');
      } else {
        await onUpdateUser(
          { id: '', fullName, email, active: true, roles: selectedBundles },
          true,
          selectedBundles,
          effectivePermissionsPreview
        );
        setFormSuccess('Utilizador registado com sucesso!');
      }

      setTimeout(() => {
        setIsModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Falha ao guardar utilizador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status with Last Admin Protection
  const handleToggleUserActive = async (user: UserSummary) => {
    if (user.active) {
      const activeAdmins = users.filter(
        (u) => u.active && (u.roles.includes('ADMIN') || (u.bundles && u.bundles.includes('ADMIN')))
      );
      if (
        activeAdmins.length === 1 &&
        activeAdmins[0].id === user.id
      ) {
        alert('Proteção de Segurança: O último Administrador ativo não pode ser desativado.');
        return;
      }
    }
    await onUpdateUser(user, !user.active);
  };

  // Filter Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? u.active
          : !u.active;
      const matchBundle =
        bundleFilter === 'ALL'
          ? true
          : u.roles.includes(bundleFilter) || (u.bundles && u.bundles.includes(bundleFilter));
      return matchSearch && matchStatus && matchBundle;
    });
  }, [users, search, statusFilter, bundleFilter]);

  const [adminSection, setAdminSection] = useState<'users' | 'settings' | 'license'>('users');

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setAdminSection('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            adminSection === 'users'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">group</span>
          Utilizadores & Permissões
        </button>
        <button
          type="button"
          onClick={() => setAdminSection('license')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            adminSection === 'license'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">card_membership</span>
          Plano & Licença SaaS
        </button>
        <button
          type="button"
          onClick={() => setAdminSection('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            adminSection === 'settings'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-base">settings</span>
          Cotações & Dados Bancários
        </button>
      </div>

      {adminSection === 'license' && (
        <LicenseManagementPage />
      )}

      {adminSection !== 'license' && (
        <>
          {/* Header Cards */}
          <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
          <p className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300">Modo do Sistema</p>
          <p className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-100">PRODUÇÃO</p>
          <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-400">
            Ambiente operacional ativo e pronto a utilizar.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-[#1f2325]">
          <p className="text-xs font-black uppercase text-slate-500">Utilizadores Registados</p>
          <p className="mt-1 text-2xl font-black text-slate-800 dark:text-slate-100">{users.length}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-bold">
            {users.filter((u) => u.active).length} perfis ativos
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-[#1f2325]">
          <p className="text-xs font-black uppercase text-slate-500">Pacotes Disponíveis</p>
          <p className="mt-1 text-2xl font-black text-slate-800 dark:text-slate-100">
            {RESPONSIBILITY_BUNDLES.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Pacotes de Responsabilidades</p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-[#1f2325]">
          <p className="text-xs font-black uppercase text-slate-500">Permissões da Sessão</p>
          <p className="mt-1 text-2xl font-black text-[#003366] dark:text-[#a7c8ff]">{permissions.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Permissões ativas no token</p>
        </div>
      </section>

      {/* Quotation & Bank Settings Section */}
      <section className="rounded-lg border border-[#c3c6d1] dark:border-[#43474f] bg-white dark:bg-[#1f2325] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#c3c6d1] dark:border-[#43474f] pb-3">
          <div>
            <h2 className="text-sm font-black uppercase text-[#003366] dark:text-[#a7c8ff] flex items-center">
              <span className="material-symbols-outlined mr-2 text-lg">account_balance</span>
              Configurações Globais de Cotações & Dados Bancários (Salvar Padrão)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Edite e salve aqui os números de conta bancária, NIB, validade e observações por defeito para todas as próximas cotações do sistema.
            </p>
          </div>
        </div>

        {settingsSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-xs font-bold flex items-center">
            <span className="material-symbols-outlined text-base mr-2">check_circle</span>
            {settingsSuccess}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="grid grid-cols-12 gap-4 text-xs font-sans">
          {bankAccounts.map((bank, idx) => (
            <div key={idx} className="col-span-12 grid grid-cols-12 gap-3 items-end border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="col-span-12 sm:col-span-3">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {idx === 0 ? 'Nome do Banco' : ''}
                </label>
                <input type="text" value={bank.bankName}
                  onChange={(e) => { const updated = [...bankAccounts]; updated[idx] = {...updated[idx], bankName: e.target.value}; setBankAccounts(updated); }}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#282c2e] font-bold text-xs"
                  placeholder="Ex: BCI, NedBank..." required />
              </div>
              <div className="col-span-12 sm:col-span-3">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {idx === 0 ? 'Nº Conta' : ''}
                </label>
                <input type="text" value={bank.account}
                  onChange={(e) => { const updated = [...bankAccounts]; updated[idx] = {...updated[idx], account: e.target.value}; setBankAccounts(updated); }}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#282c2e] font-mono text-xs"
                  placeholder="Nº conta" required />
              </div>
              <div className="col-span-12 sm:col-span-4">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {idx === 0 ? 'NIB' : ''}
                </label>
                <input type="text" value={bank.nib}
                  onChange={(e) => { const updated = [...bankAccounts]; updated[idx] = {...updated[idx], nib: e.target.value}; setBankAccounts(updated); }}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#282c2e] font-mono text-xs"
                  placeholder="NIB" required />
              </div>
              <div className="col-span-12 sm:col-span-2 flex gap-2">
                {bankAccounts.length > 1 && (
                  <button type="button" onClick={() => setBankAccounts(bankAccounts.filter((_, i) => i !== idx))}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Remover banco">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="col-span-12">
            <button type="button"
              onClick={() => setBankAccounts([...bankAccounts, { bankName: '', account: '', nib: '' }])}
              className="text-xs font-bold text-[#003366] dark:text-[#a7c8ff] hover:underline flex items-center">
              <span className="material-symbols-outlined text-sm mr-1">add_circle</span>
              Adicionar Banco
            </button>
          </div>
          <div className="col-span-12 sm:col-span-4">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Validade por Defeito (ex: 7 dias)</label>
            <input
              type="text"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#282c2e] font-sans text-xs"
              required
            />
          </div>
          <div className="col-span-12 sm:col-span-8">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Observações Padrão no Rodapé da Cotação</label>
            <input
              type="text"
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#282c2e] font-sans text-xs"
            />
          </div>
          <div className="col-span-12 flex justify-end">
            <button
              type="submit"
              disabled={settingsSaving}
              className="px-5 py-2 bg-[#006e25] text-white font-bold text-xs rounded hover:brightness-110 flex items-center transition-all shadow"
            >
              <span className="material-symbols-outlined text-sm mr-1">save</span>
              {settingsSaving ? 'A guardar...' : '💾 Salvar Configurações Permanentemente'}
            </button>
          </div>
        </form>
      </section>

      {/* Main Table Card */}
      <section className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-[#1f2325]">
        <header className="flex flex-col gap-3 border-b bg-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800">
          <div>
            <h2 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
              Administração de Utilizadores & Pacotes de Responsabilidades
            </h2>
            <p className="text-xs text-slate-500">
              Atribuição simplificada por perfis funcionais e controlo granular de acessos
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-[#003366] px-4 py-2 text-xs font-bold text-white hover:bg-[#001e40] transition-colors shadow"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            <span>Criar Novo Utilizador</span>
          </button>
        </header>

        {/* Filters */}
        <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-3 dark:bg-slate-800/50">
          <div>
            <label htmlFor="admin-user-search" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Pesquisar Utilizador
            </label>
            <input
              id="admin-user-search"
              type="text"
              placeholder="Nome ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-1.5 text-xs dark:bg-slate-900"
            />
          </div>
          <div>
            <label htmlFor="admin-status-filter" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Filtrar por Estado
            </label>
            <select
              id="admin-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-md border bg-white px-3 py-1.5 text-xs dark:bg-slate-900"
            >
              <option value="ALL">Todos os estados</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="INACTIVE">Apenas Inativos</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-bundle-filter" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Filtrar por Pacote
            </label>
            <select
              id="admin-bundle-filter"
              value={bundleFilter}
              onChange={(e) => setBundleFilter(e.target.value)}
              className="w-full rounded-md border bg-white px-3 py-1.5 text-xs dark:bg-slate-900"
            >
              <option value="ALL">Todos os pacotes</option>
              {RESPONSIBILITY_BUNDLES.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-slate-50 uppercase font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <th className="p-3">Utilizador</th>
                <th className="p-3">Email</th>
                <th className="p-3">Pacotes de Responsabilidades</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono">
              {filteredUsers.map((user) => {
                const userBundleCodes = user.bundles && user.bundles.length > 0 ? user.bundles : user.roles;
                return (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      {user.fullName}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{user.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {userBundleCodes.map((code) => {
                          const b = getBundleByCode(code);
                          return (
                            <span
                              key={code}
                              className={`inline-flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-extrabold ${
                                code === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : 'bg-blue-100 text-blue-900 border border-blue-300'
                              }`}
                            >
                              <span>{b ? b.name : code}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          user.active
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {user.active ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Editar Pacotes
                      </button>
                      <button
                        onClick={() => void handleToggleUserActive(user)}
                        className={`rounded px-2.5 py-1 text-[11px] font-bold text-white transition-colors ${
                          user.active
                            ? 'bg-red-700 hover:bg-red-800'
                            : 'bg-emerald-700 hover:bg-emerald-800'
                        }`}
                      >
                        {user.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                    Nenhum utilizador encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}

      {/* USER CREATION & EDITING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="admin-user-dialog-title" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border bg-white shadow-2xl dark:bg-[#1f2325] dark:text-slate-100 p-6 space-y-6">
            <header className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 id="admin-user-dialog-title" className="text-base font-black text-[#003366] dark:text-[#a7c8ff]">
                  {editingUser ? `Editar Utilizador: ${editingUser.fullName}` : 'Criar Novo Utilizador'}
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione um ou vários Pacotes de Responsabilidades para atribuir acessos automáticos
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            {formError && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                ⚠️ {formError}
              </div>
            )}

            {formSuccess && (
              <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                ✅ {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="admin-full-name" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    id="admin-full-name"
                    autoFocus
                    type="text"
                    required
                    placeholder="Ex: João Manuel"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-md border bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="admin-email" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Email / Utilizador *
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    placeholder="joao@empresa.co.mz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border bg-slate-50 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="admin-password" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    {editingUser ? 'Nova Palavra-passe (Opcional)' : 'Palavra-passe Inicial *'}
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    required={!editingUser}
                    minLength={6}
                    placeholder={editingUser ? 'Deixar em branco para manter a actual' : 'Mínimo 6 caracteres'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border bg-slate-50 px-3 py-2 text-xs font-mono dark:bg-[#1f2325]"
                  />
                </div>
                <div>
                  <label htmlFor="admin-telephone" className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Contacto Telefónico
                  </label>
                  <input
                    id="admin-telephone"
                    type="text"
                    placeholder="+258 84 123 4567"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="w-full rounded-md border bg-slate-50 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* RESPONSIBILITY BUNDLES SELECTION */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                  Pacotes de Responsabilidades (Selecione um ou vários)
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {RESPONSIBILITY_BUNDLES.map((bundle) => {
                    const isSelected = selectedBundles.includes(bundle.code);
                    return (
                      <label
                        key={bundle.code}
                        className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-all ${
                          isSelected
                            ? 'border-[#003366] bg-blue-50/60 ring-2 ring-[#003366]/20 dark:bg-slate-800'
                            : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleBundle(bundle.code)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]"
                        />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="material-symbols-outlined text-base text-[#003366] dark:text-[#a7c8ff]">
                              {bundle.icon}
                            </span>
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                              {bundle.name}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                            {bundle.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* LIVE BUSINESS CAPABILITIES PREVIEW */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4 dark:bg-slate-900">
                <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <span className="material-symbols-outlined text-sm text-[#003366]">preview</span>
                  <span>Pré-visualização das Funcionalidades do Utilizador</span>
                </h4>

                {/* Allowed Capabilities */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                    🟢 Este utilizador poderá:
                  </p>
                  <ul className="space-y-1 pl-4 text-xs text-slate-700 dark:text-slate-300 list-disc">
                    {capabilities.allowed.map((cap, idx) => (
                      <li key={idx}>{cap}</li>
                    ))}
                  </ul>
                </div>

                {/* Forbidden Capabilities */}
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-[11px] font-extrabold uppercase text-red-700 dark:text-red-400">
                    🔴 Este utilizador NÃO poderá:
                  </p>
                  <ul className="space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400 list-disc">
                    {capabilities.forbidden.map((cap, idx) => (
                      <li key={idx}>{cap}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ADVANCED PERMISSION CUSTOMIZATION (COLLAPSIBLE) */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="flex items-center space-x-2 text-xs font-bold text-[#003366] hover:underline"
                >
                  <span className="material-symbols-outlined text-base">
                    {showAdvanced ? 'expand_less' : 'expand_more'}
                  </span>
                  <span>Personalizar permissões (Exceções Avançadas)</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 rounded-lg border bg-white p-4 space-y-3 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-500">
                      Adicione permissões específicas de exceção sem alterar a estrutura dos pacotes selecionados.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ADVANCED_OVERRIDE_PERMISSIONS.map((override) => {
                        const isAdded = customAdditions.includes(override.code);
                        return (
                          <label
                            key={override.code}
                            className="flex items-start space-x-2 text-xs p-2 rounded border bg-slate-50 dark:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={isAdded}
                              onChange={() => handleToggleAddition(override.code)}
                              className="mt-0.5 h-3.5 w-3.5 rounded text-[#003366]"
                            />
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {override.name}
                              </span>
                              <p className="text-[10px] text-slate-500 leading-tight">
                                {override.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-2 rounded-lg bg-[#003366] px-5 py-2 text-xs font-bold text-white hover:bg-[#001e40] shadow disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>A guardar…</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>{editingUser ? 'Guardar Alterações' : 'Criar Utilizador'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export { Administration as AdministrationPage };
export default Administration;
