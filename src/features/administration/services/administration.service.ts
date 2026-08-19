import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { CompanyProfile, UserSummary } from '@/shared/types/domain.types';

export const AdministrationService = {
  async updateUser(
    user: UserSummary,
    active: boolean,
    newBundles?: string[],
    newPermissions?: string[],
    newPassword?: string,
  ): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_company_user_v2', {
      p_user_id: user.id,
      p_active: active,
      p_responsibility_bundles: newBundles || null,
      p_extra_permissions: newPermissions || null,
      p_new_password: newPassword?.trim() || null,
    });

    if (error) {
      logger.error('Failed to update user', error, { module: 'AdministrationService', userId: user.id });
      throw new AppError(error.message || 'Falha ao actualizar o utilizador.');
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
    if (!userData.fullName.trim()) throw new ValidationError('O nome completo é obrigatório.');
    if (!userData.email.trim()) throw new ValidationError('O email é obrigatório.');

    const client = requireSupabase();
    const { error } = await client.rpc('admin_create_company_user_v2', {
      p_full_name: userData.fullName.trim(),
      p_email: userData.email.trim().toLowerCase(),
      p_password: userData.password || null,
      p_responsibility_bundles: userData.bundles,
      p_extra_permissions: userData.permissions,
      p_telephone: userData.telephone?.trim() || null,
    });

    if (error) {
      logger.error('Failed to create company user', error, { module: 'AdministrationService', email: userData.email });
      throw new AppError(error.message || 'Falha ao criar o utilizador.');
    }
  },
};
