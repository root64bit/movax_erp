import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError } from '@/shared/utils/errorUtils';
import type { UserSummary } from '@/shared/types/domain.types';

export const AdministrationService = {
  async setOperationalContext(warehouseId: string, posTerminalId?: string): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('set_operational_context_v1', {
      p_warehouse_id: warehouseId,
      p_pos_terminal_id: posTerminalId || null,
    });
    if (error) {
      logger.error('Failed to set operational context', error, { module: 'AdministrationService', warehouseId, posTerminalId });
      throw new AppError(error.message || 'Falha ao definir contexto operacional.');
    }
  },

  async createUser(userData: {
    fullName: string;
    email: string;
    password?: string;
    bundles: string[];
    permissions: string[];
    telephone?: string;
  }): Promise<void> {
    const client = requireSupabase();
    logger.info('Creating user via AdministrationService', { email: userData.email });
    // In current implementation, updates or inserts into user profile/roles
    const { error } = await client.from('user_profiles').insert({
      full_name: userData.fullName.trim(),
      email: userData.email.trim(),
      phone: userData.telephone?.trim() || null,
      is_active: true,
    });
    if (error) {
      logger.error('Failed to create user', error, { module: 'AdministrationService' });
      throw new AppError(error.message || 'Falha ao criar utilizador.');
    }
  },

  async updateUser(
    user: UserSummary,
    active: boolean,
    newBundles?: string[],
    newPermissions?: string[],
    newPassword?: string
  ): Promise<void> {
    const client = requireSupabase();
    logger.info('Updating user via AdministrationService', { userId: user.id });
    const { error } = await client
      .from('user_profiles')
      .update({
        is_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (error) {
      logger.error('Failed to update user', error, { module: 'AdministrationService', userId: user.id });
      throw new AppError(error.message || 'Falha ao atualizar utilizador.');
    }
  },
};
