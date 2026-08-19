import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PublicRoutes } from './PublicRoutes';
import { PrivateRoutes } from './PrivateRoutes';
import { PageLoader } from '@/shared/components/feedback';
import { env } from '@/app/config/env';
import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import type { UserContext } from '@/shared/types/domain.types';

export const AppRouter: React.FC = () => {
  const { session, checking, signOut } = useAuth();
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [loadingContext, setLoadingContext] = useState<boolean>(false);

  const loadUserContext = useCallback(async () => {
    if (!session) {
      setUserContext(null);
      setLoadError('');
      return;
    }

    setLoadingContext(true);
    setLoadError('');

    if (env.useMockData) {
      setUserContext({
        userId: session.user?.id || 'usr-001',
        companyId: 'a0000000-0000-0000-0000-000000000001',
        fullName: session.user?.user_metadata?.full_name || 'Administrador Geral',
        email: session.user?.email || 'admin@casadepneus.co.mz',
        isActive: true,
        forcePasswordChange: false,
        roles: [{ code: 'ADMIN', name: 'Administrador do Sistema' }],
        permissions: ['*'],
        branches: [{ id: 'b001', code: 'SED', name: 'Sede Maputo' }],
        warehouses: [{ id: 'w001', code: 'ARM1', name: 'Armazém Principal' }],
        activeWarehouse: { id: 'w001', code: 'ARM1', name: 'Armazém Principal' },
        activePosTerminal: { id: 'pos001', code: 'POS-01', name: 'Caixa 01' },
        systemMode: 'ONLINE',
      });
      setLoadingContext(false);
      return;
    }

    try {
      const client = requireSupabase();

      // Primary: Call the canonical get_current_user_context RPC
      const { data: ctxData, error: ctxErr } = await client.rpc('get_current_user_context');

      if (!ctxErr && ctxData && ctxData.company_id) {
        setUserContext({
          userId: ctxData.user_id || session.user.id,
          companyId: ctxData.company_id,
          fullName: ctxData.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Utilizador',
          email: ctxData.email || session.user.email || '',
          isActive: ctxData.is_active !== false,
          forcePasswordChange: Boolean(ctxData.force_password_change),
          roles: Array.isArray(ctxData.roles)
            ? ctxData.roles.map((r: any) => ({
                code: typeof r === 'string' ? r : r.code || r.role_code || 'USER',
                name: typeof r === 'string' ? r : r.name || r.role_name || r.code || 'Utilizador',
              }))
            : [],
          permissions: Array.isArray(ctxData.permissions)
            ? ctxData.permissions.map((p: any) => String(p.permission_code || p.code || p))
            : [],
          branches: Array.isArray(ctxData.branches)
            ? ctxData.branches.map((b: any) => ({ id: b.id || b.branch_id, code: b.code || '', name: b.name || '' }))
            : [],
          warehouses: Array.isArray(ctxData.warehouses)
            ? ctxData.warehouses.map((w: any) => ({ id: w.id || w.warehouse_id, code: w.code || '', name: w.name || '' }))
            : [],
          activeBranch: ctxData.active_branch
            ? { id: ctxData.active_branch.id || ctxData.active_branch.branch_id, code: ctxData.active_branch.code || '', name: ctxData.active_branch.name || '' }
            : undefined,
          activeWarehouse: ctxData.active_warehouse
            ? { id: ctxData.active_warehouse.id || ctxData.active_warehouse.warehouse_id, code: ctxData.active_warehouse.code || '', name: ctxData.active_warehouse.name || '' }
            : undefined,
          activePosTerminal: ctxData.active_pos_terminal
            ? {
                id: ctxData.active_pos_terminal.id || ctxData.active_pos_terminal.pos_terminal_id,
                code: ctxData.active_pos_terminal.code || ctxData.active_pos_terminal.terminal_code || '',
                name: ctxData.active_pos_terminal.name || ctxData.active_pos_terminal.display_name || '',
                seriesPrefix: ctxData.active_pos_terminal.series_prefix || ctxData.active_pos_terminal.invoice_series_prefix,
              }
            : undefined,
          systemMode: ctxData.system_mode || 'LIVE',
        });
        return;
      }

      // Secondary fallback
      const companyIdResult = await client.rpc('get_user_company_id');
      if (companyIdResult.error || !companyIdResult.data) {
        throw companyIdResult.error ?? new Error('Empresa do utilizador não configurada.');
      }

      const activeContextResult = await client.rpc('get_active_operational_context_v1');
      const activeContext = activeContextResult.data?.[0];
      const rolesResult = await client.rpc('get_user_effective_roles_v1');
      const permissionsResult = await client.rpc('get_user_effective_permissions_v1');

      const user = session.user;
      setUserContext({
        userId: user.id,
        companyId: activeContext?.company_id || companyIdResult.data,
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilizador',
        email: user.email || '',
        isActive: true,
        forcePasswordChange: Boolean(user.user_metadata?.force_password_change),
        roles: (rolesResult.data || []).map((r: any) => ({
          code: String(r.role_code || r.code || r),
          name: String(r.role_name || r.name || r),
        })),
        permissions: (permissionsResult.data || []).map((p: any) => String(p.permission_code || p)),
        branches: [],
        warehouses: [],
        activeWarehouse: activeContext?.active_warehouse_id
          ? { id: activeContext.active_warehouse_id, code: 'WH-1', name: activeContext.active_warehouse_name || 'Armazém Principal' }
          : undefined,
        activePosTerminal: activeContext?.active_pos_terminal_id
          ? { id: activeContext.active_pos_terminal_id, code: 'POS-1', name: 'Terminal POS' }
          : undefined,
        systemMode: 'ONLINE',
      });
    } catch (err: any) {
      logger.error('Failed to load user operational context', err, { module: 'AppRouter' });
      setLoadError(err.message || 'Falha ao autenticar utilizador ou carregar perfil.');
    } finally {
      setLoadingContext(false);
    }
  }, [session]);

  useEffect(() => {
    void loadUserContext();
  }, [loadUserContext]);

  if (checking) {
    return <PageLoader message="A iniciar Movax ERP..." />;
  }

  return (
    <PublicRoutes
      session={session}
      checkingSession={checking || (Boolean(session) && loadingContext && !userContext && !loadError)}
      userContext={userContext}
      dataError={loadError}
      onRetry={loadUserContext}
      onPasswordChanged={async () => {
        await loadUserContext();
      }}
    >
      <PrivateRoutes userContext={userContext} onRefreshData={loadUserContext} />
    </PublicRoutes>
  );
};
