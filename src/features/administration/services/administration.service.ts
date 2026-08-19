import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
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
    if (!userData.fullName?.trim()) throw new ValidationError('O nome completo é obrigatório.');
    if (!userData.email?.trim()) throw new ValidationError('O email é obrigatório.');
    if (!userData.bundles || userData.bundles.length === 0) {
      throw new ValidationError('Pelo menos um Pacote de Responsabilidades deve ser selecionado.');
    }

    const client = requireSupabase();
    const primaryRole = userData.bundles[0] || 'MANAGER_LIMITED';

    // 1. Try admin_create_company_user_v2 RPC first
    const rpcResult = await client.rpc('admin_create_company_user_v2', {
      p_full_name: userData.fullName.trim(),
      p_email: userData.email.trim().toLowerCase(),
      p_password: userData.password || null,
      p_responsibility_bundles: userData.bundles,
      p_extra_permissions: userData.permissions,
      p_telephone: userData.telephone?.trim() || null,
    });

    if (!rpcResult.error) {
      logger.info('User created via admin_create_company_user_v2', { email: userData.email });
      return;
    }

    // 2. Fallback to admin_create_user_profile with role assignment
    const generatedUserId = crypto.randomUUID();
    const username = userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');

    const profileResult = await client.rpc('admin_create_user_profile', {
      p_user_id: generatedUserId,
      p_username: username,
      p_full_name: userData.fullName.trim(),
      p_email: userData.email.trim().toLowerCase(),
      p_phone: userData.telephone?.trim() || null,
      p_role_code: primaryRole,
    });

    if (profileResult.error) {
      // 3. Fallback to direct insertion if user has users.manage permission
      const { error: directErr } = await client.from('user_profiles').insert({
        id: generatedUserId,
        full_name: userData.fullName.trim(),
        email: userData.email.trim().toLowerCase(),
        phone: userData.telephone?.trim() || null,
        is_active: true,
      });

      if (directErr) {
        logger.error('Failed to create company user', directErr, { module: 'AdministrationService', email: userData.email });
        throw new AppError(profileResult.error.message || directErr.message || 'Falha ao criar o utilizador.');
      }
    }

    // Assign remaining bundle roles if multiple bundles selected
    if (userData.bundles.length > 1) {
      const { data: roles } = await client
        .from('roles')
        .select('id, code')
        .in('code', userData.bundles);

      if (roles && roles.length > 0) {
        const roleInserts = roles.map((r: { id: string }) => ({
          user_id: generatedUserId,
          role_id: r.id,
        }));
        await client.from('user_roles').upsert(roleInserts, { onConflict: 'user_id,role_id' });
      }
    }
  },

  async updateUser(
    user: UserSummary,
    active: boolean,
    newBundles?: string[],
    newPermissions?: string[],
    newPassword?: string,
  ): Promise<void> {
    if (!user?.id) throw new ValidationError('Identificador de utilizador inválido.');
    const client = requireSupabase();

    // 1. Try admin_update_company_user_v2 RPC first
    const rpcResult = await client.rpc('admin_update_company_user_v2', {
      p_user_id: user.id,
      p_active: active,
      p_responsibility_bundles: newBundles || null,
      p_extra_permissions: newPermissions || null,
      p_new_password: newPassword?.trim() || null,
    });

    if (!rpcResult.error) {
      logger.info('User updated via admin_update_company_user_v2', { userId: user.id });
      return;
    }

    // 2. Fallback to admin_update_user_profile
    const profileResult = await client.rpc('admin_update_user_profile', {
      p_user_id: user.id,
      p_full_name: user.fullName.trim(),
      p_is_active: active,
    });

    if (profileResult.error) {
      // 3. Direct table update fallback
      const { error: directErr } = await client
        .from('user_profiles')
        .update({
          full_name: user.fullName.trim(),
          is_active: active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (directErr) {
        logger.error('Failed to update user profile', directErr, { module: 'AdministrationService', userId: user.id });
        throw new AppError(profileResult.error.message || directErr.message || 'Falha ao actualizar o utilizador.');
      }
    }

    // Synchronize roles/bundles if specified
    if (newBundles && newBundles.length > 0) {
      const { data: matchedRoles } = await client
        .from('roles')
        .select('id, code')
        .in('code', newBundles);

      if (matchedRoles && matchedRoles.length > 0) {
        await client.from('user_roles').delete().eq('user_id', user.id);
        const inserts = matchedRoles.map((r: { id: string }) => ({
          user_id: user.id,
          role_id: r.id,
        }));
        await client.from('user_roles').insert(inserts);
      }
    }
  },
};
