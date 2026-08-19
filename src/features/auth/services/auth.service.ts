import { requireSupabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError } from '@/shared/utils/errorUtils';
import type { Session } from '@supabase/supabase-js';

export const AuthService = {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  },

  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured) return null;
    const client = requireSupabase();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      logger.warn('Failed to fetch session', { module: 'AuthService', error });
      return null;
    }
    return session;
  },

  async signIn(email: string, pass: string): Promise<Session | null> {
    const client = requireSupabase();
    logger.info('User sign-in attempt', { module: 'AuthService', email });
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      logger.warn('User sign-in failed', { module: 'AuthService', error: error.message });
      throw new AppError(error.message, error.status ? String(error.status) : 'AUTH_ERROR');
    }
    return data.session;
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured) return;
    const client = requireSupabase();
    logger.info('User sign-out', { module: 'AuthService' });
    const { error } = await client.auth.signOut();
    if (error) {
      logger.warn('Sign-out error', { module: 'AuthService', error });
    }
  },

  async resetPassword(email: string): Promise<void> {
    const client = requireSupabase();
    logger.info('Password reset requested', { module: 'AuthService', email });
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw new AppError(error.message, 'RESET_PASSWORD_ERROR');
  },

  async updatePassword(pass: string): Promise<void> {
    const client = requireSupabase();
    const { error: updateError } = await client.auth.updateUser({ password: pass });
    if (updateError) throw new AppError(updateError.message, 'UPDATE_PASSWORD_ERROR');
    
    const { error: completionError } = await client.rpc('complete_first_login_password_change');
    if (completionError) {
      logger.warn('Password changed but RPC complete_first_login_password_change failed', { module: 'AuthService' });
    }
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };
    const client = requireSupabase();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },
};
