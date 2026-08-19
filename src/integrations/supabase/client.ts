import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/app/config/env';
import { logger } from '@/shared/lib/logger';

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    const errorMsg = 'Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ficheiro .env.';
    logger.error(errorMsg, undefined, { module: 'supabase-client' });
    throw new Error(errorMsg);
  }
  return supabase;
}
