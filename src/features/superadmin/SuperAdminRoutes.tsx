import React, { lazy, Suspense, useState, useEffect } from 'react';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { PageLoader } from '@/shared/components/feedback';
import { AuthService } from '@/features/auth';

const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Dashboard)</div> })));
const CompaniesListPage = lazy(() => import('./pages/CompaniesListPage').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Empresas)</div> })));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Detalhes da Empresa)</div> })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Pagamentos)</div> })));
const PlansConfigPage = lazy(() => import('./pages/PlansConfigPage').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Planos)</div> })));
const ControlPage = lazy(() => import('./pages/ControlPage').catch(() => ({ default: () => <div className="p-8 text-center font-bold">Página em desenvolvimento (Controlo)</div> })));

export interface SuperAdminRoutesProps {
  userLabel?: string;
}

export const SuperAdminRoutes: React.FC<SuperAdminRoutesProps> = ({ userLabel }) => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    const p = window.location.pathname.replace('/superadmin', '').replace(/^\/+/, '');
    if (!p) return 'overview';
    if (p.startsWith('companies/')) return 'company_detail';
    return p;
  });

  const [companyId, setCompanyId] = useState<string | null>(() => {
    const p = window.location.pathname;
    const match = p.match(/\/superadmin\/companies\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.replace('/superadmin', '').replace(/^\/+/, '');
      if (!p) {
        setActiveTab('overview');
        setCompanyId(null);
      } else if (p.startsWith('companies/')) {
        const match = window.location.pathname.match(/\/superadmin\/companies\/([a-zA-Z0-9-]+)/);
        setCompanyId(match ? match[1] : null);
        setActiveTab('company_detail');
      } else {
        setActiveTab(p);
        setCompanyId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCompanyId(null);
  };

  const handleCompanySelect = (id: string) => {
    setCompanyId(id);
    setActiveTab('company_detail');
    window.history.pushState({}, '', `/superadmin/companies/${id}`);
  };

  const currentTab = activeTab === 'company_detail' ? 'companies' : activeTab;

  return (
    <SuperAdminLayout
      activeTab={currentTab}
      setActiveTab={handleTabChange}
      userLabel={userLabel}
      onSignOut={() => void AuthService.signOut()}
    >
      <Suspense fallback={<PageLoader message="A carregar painel super admin..." />}>
        {activeTab === 'overview' && <SuperAdminDashboard />}
        {activeTab === 'companies' && <CompaniesListPage onSelectCompany={handleCompanySelect} />}
        {activeTab === 'company_detail' && <CompanyDetailPage companyId={companyId!} onBack={() => handleTabChange('companies')} />}
        {activeTab === 'payments' && <PaymentsPage />}
        {activeTab === 'control' && <ControlPage />}
        {activeTab === 'plans' && <PlansConfigPage />}
      </Suspense>
    </SuperAdminLayout>
  );
};
