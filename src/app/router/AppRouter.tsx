import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PublicRoutes } from './PublicRoutes';
import { PrivateRoutes } from './PrivateRoutes';
import { PageLoader } from '@/shared/components/feedback';
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
    try {
      const client = requireSupabase();
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
        companyId: activeContext?.company_id || 'default-company',
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
