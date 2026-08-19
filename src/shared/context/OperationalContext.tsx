import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { AccessScope, UserContext } from '@/shared/types/domain.types';
import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';

interface OperationalContextValue {
  activeWarehouseId: string;
  activeWarehouseName: string;
  warehouses: AccessScope[];
  activePosTerminalId?: string;
  permissions: string[];
  roles: string[];
  isOnline: boolean;
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  hasAllPermissions: (permissionCodes: string[]) => boolean;
  switchWarehouse: (warehouseId: string) => Promise<void>;
  setPosTerminal: (terminalId?: string) => Promise<void>;
}

const OperationalContext = createContext<OperationalContextValue | null>(null);

export interface OperationalProviderProps {
  initialUserContext?: UserContext | null;
  children: ReactNode;
}

export const OperationalProvider: React.FC<OperationalProviderProps> = ({
  initialUserContext,
  children,
}) => {
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(
    initialUserContext?.activeWarehouse?.id || ''
  );
  const [activeWarehouseName, setActiveWarehouseName] = useState<string>(
    initialUserContext?.activeWarehouse?.name || 'Armazém Principal'
  );
  const [warehouses, setWarehouses] = useState<AccessScope[]>(
    initialUserContext?.warehouses || []
  );
  const [activePosTerminalId, setActivePosTerminalId] = useState<string | undefined>(
    initialUserContext?.activePosTerminal?.id
  );
  const [permissions, setPermissions] = useState<string[]>(
    initialUserContext?.permissions || []
  );
  const [roles, setRoles] = useState<string[]>(
    initialUserContext?.roles?.map((r) => (typeof r === 'string' ? r : r.code)) || []
  );
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    if (initialUserContext) {
      setActiveWarehouseId(initialUserContext.activeWarehouse?.id || '');
      setActiveWarehouseName(initialUserContext.activeWarehouse?.name || 'Armazém Principal');
      setWarehouses(initialUserContext.warehouses || []);
      setActivePosTerminalId(initialUserContext.activePosTerminal?.id);
      setPermissions(initialUserContext.permissions || []);
      setRoles(initialUserContext.roles?.map((r) => (typeof r === 'string' ? r : r.code)) || []);
    }
  }, [initialUserContext]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasPermission = useCallback(
    (code: string) => {
      if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
      return permissions.includes(code);
    },
    [permissions, roles]
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => {
      if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
      return codes.some((code) => permissions.includes(code));
    },
    [permissions, roles]
  );

  const hasAllPermissions = useCallback(
    (codes: string[]) => {
      if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return true;
      return codes.every((code) => permissions.includes(code));
    },
    [permissions, roles]
  );

  const switchWarehouse = useCallback(
    async (warehouseId: string) => {
      logger.info('Switching operational warehouse', { module: 'OperationalContext', warehouseId });
      const client = requireSupabase();
      const { error } = await client.rpc('set_operational_context_v1', {
        p_warehouse_id: warehouseId,
        p_pos_terminal_id: activePosTerminalId || null,
      });
      if (error) {
        logger.error('Failed to set operational context', error, { module: 'OperationalContext' });
        throw error;
      }
      const selected = warehouses.find((w) => w.id === warehouseId);
      setActiveWarehouseId(warehouseId);
      if (selected) {
        setActiveWarehouseName(selected.name);
      }
    },
    [activePosTerminalId, warehouses]
  );

  const setPosTerminal = useCallback(
    async (terminalId?: string) => {
      logger.info('Setting active POS terminal', { module: 'OperationalContext', terminalId });
      const client = requireSupabase();
      const { error } = await client.rpc('set_operational_context_v1', {
        p_warehouse_id: activeWarehouseId,
        p_pos_terminal_id: terminalId || null,
      });
      if (error) throw error;
      setActivePosTerminalId(terminalId);
    },
    [activeWarehouseId]
  );

  const value = useMemo(
    () => ({
      activeWarehouseId,
      activeWarehouseName,
      warehouses,
      activePosTerminalId,
      permissions,
      roles,
      isOnline,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      switchWarehouse,
      setPosTerminal,
    }),
    [
      activeWarehouseId,
      activeWarehouseName,
      warehouses,
      activePosTerminalId,
      permissions,
      roles,
      isOnline,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      switchWarehouse,
      setPosTerminal,
    ]
  );

  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>;
};

export function useOperationalContext(): OperationalContextValue {
  const context = useContext(OperationalContext);
  if (!context) {
    throw new Error('useOperationalContext must be used within an OperationalProvider');
  }
  return context;
}
