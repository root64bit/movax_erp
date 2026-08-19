import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError } from '@/shared/utils/errorUtils';

export interface DashboardKPIs {
  activeCompanies: number;
  revenueThisMonth: number;
  activeSubscriptions: number;
  pendingPayments: number;
  companiesByPlan: { plan: string; count: number }[];
  recentActivity: { id: string; companyName: string; description: string; amount: number; status: string; createdAt: string }[];
}

export interface CompanyRow {
  id: string;
  name: string;
  taxNumber: string;
  tenantCode: string;
  email: string;
  phone: string;
  city: string;
  isActive: boolean;
  planCode: string;
  planStatus: string;
  userCount: number;
  branchCount: number;
  warehouseCount: number;
  posTerminalCount: number;
  subscriptionStartsAt: string;
  subscriptionExpiresAt: string;
  lastPaymentAmount: number;
  lastPaymentDate: string;
}

export interface PaymentRow {
  id: string;
  companyName: string;
  planCode: string;
  method: string;
  reference: string;
  amount: number;
  status: string;
  paidAt: string;
  createdAt: string;
}

export interface RevenuePoint {
  month: number;
  year: number;
  total: number;
}

export const SuperAdminService = {
  async fetchDashboardKPIs(): Promise<DashboardKPIs> {
    const supabase = requireSupabase();
    try {
      const { data, error } = await supabase.rpc('get_superadmin_dashboard_v1');
      if (error) throw error;
      
      const res = data as any;
      return {
        activeCompanies: res.active_companies || 0,
        revenueThisMonth: Number(res.revenue_this_month) || 0,
        activeSubscriptions: res.active_subscriptions || 0,
        pendingPayments: res.pending_payments || 0,
        companiesByPlan: (res.companies_by_plan || []).map((p: any) => ({
          plan: p.plan,
          count: p.count
        })),
        recentActivity: (res.recent_activity || []).map((a: any) => ({
          id: a.id,
          companyName: a.company_name,
          description: a.description,
          amount: Number(a.amount) || 0,
          status: a.status,
          createdAt: a.created_at
        }))
      };
    } catch (err) {
      logger.error('SuperAdminService.fetchDashboardKPIs', err);
      throw new AppError(err instanceof Error ? err.message : 'Failed to fetch super admin dashboard KPIs', 'SUPERADMIN_DASHBOARD_ERROR');
    }
  },

  async fetchCompanies(): Promise<CompanyRow[]> {
    const supabase = requireSupabase();
    try {
      const { data, error } = await supabase.rpc('get_superadmin_companies_v1');
      if (error) throw error;
      
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        taxNumber: c.tax_number,
        tenantCode: c.tenant_code,
        email: c.email,
        phone: c.phone,
        city: c.city,
        isActive: c.is_active,
        planCode: c.plan_code,
        planStatus: c.plan_status,
        userCount: Number(c.user_count) || 0,
        branchCount: Number(c.branch_count) || 0,
        warehouseCount: Number(c.warehouse_count) || 0,
        posTerminalCount: Number(c.pos_terminal_count) || 0,
        subscriptionStartsAt: c.subscription_starts_at,
        subscriptionExpiresAt: c.subscription_expires_at,
        lastPaymentAmount: Number(c.last_payment_amount) || 0,
        lastPaymentDate: c.last_payment_date
      }));
    } catch (err) {
      logger.error('SuperAdminService.fetchCompanies', err);
      throw new AppError(err instanceof Error ? err.message : 'Failed to fetch companies', 'SUPERADMIN_COMPANIES_ERROR');
    }
  },

  async fetchCompanyDetail(companyId: string): Promise<CompanyRow & { subscription: any; users: any[]; branches: any[]; warehouses: any[] }> {
    try {
      const companies = await this.fetchCompanies();
      const comp = companies.find(c => c.id === companyId);
      if (!comp) throw new Error('Company not found');

      return {
        ...comp,
        subscription: {
           planCode: comp.planCode,
           status: comp.planStatus,
           startsAt: comp.subscriptionStartsAt,
           expiresAt: comp.subscriptionExpiresAt,
        },
        users: [],
        branches: [],
        warehouses: []
      };
    } catch (err) {
      logger.error('SuperAdminService.fetchCompanyDetail', err);
      throw new AppError(err instanceof Error ? err.message : 'Failed to fetch company details', 'SUPERADMIN_DETAIL_ERROR');
    }
  },

  async fetchPayments(filters?: { status?: string; method?: string; companyId?: string }): Promise<PaymentRow[]> {
    const supabase = requireSupabase();
    try {
      const { data, error } = await supabase.rpc('get_superadmin_payments_v1', {
        p_status: filters?.status || null,
        p_method: filters?.method || null,
        p_company_id: filters?.companyId || null
      });
      if (error) throw error;
      
      return (data || []).map((p: any) => ({
        id: p.id,
        companyName: p.company_name,
        planCode: p.plan_code,
        method: p.method,
        reference: p.reference,
        amount: Number(p.amount) || 0,
        status: p.status,
        paidAt: p.paid_at,
        createdAt: p.created_at
      }));
    } catch (err) {
      logger.error('SuperAdminService.fetchPayments', err);
      throw new AppError(err instanceof Error ? err.message : 'Failed to fetch payments', 'SUPERADMIN_PAYMENTS_ERROR');
    }
  },

  async fetchRevenueChart(months?: number): Promise<RevenuePoint[]> {
    const supabase = requireSupabase();
    try {
      const { data, error } = await supabase.rpc('get_superadmin_revenue_chart_v1', {
        p_months: months || 12
      });
      if (error) throw error;
      
      return (data || []).map((r: any) => ({
        month: Number(r.month),
        year: Number(r.year),
        total: Number(r.total) || 0
      }));
    } catch (err) {
      logger.error('SuperAdminService.fetchRevenueChart', err);
      throw new AppError(err instanceof Error ? err.message : 'Failed to fetch revenue chart', 'SUPERADMIN_REVENUE_ERROR');
    }
  },

  async fetchPlans(): Promise<any[]> {
    return [
      { code: 'STARTER', name: 'Starter', price: 4500 },
      { code: 'BUSINESS', name: 'Business', price: 8900 },
      { code: 'PRO', name: 'Pro', price: 13900 }
    ];
  }
};
