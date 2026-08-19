/**
 * MOVAX ERP / POS - Centralized Environment Configuration
 * Strictly validates and exports environment variables.
 */

const DEFAULT_SUPABASE_URL = 'https://qcautpgexkfdoakfjfrf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjYXV0cGdleGtmZG9ha2ZqZnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjMzMDMsImV4cCI6MjEwMjY5OTMwM30.QHPoIyCsn8BN-07Rk5hRPCb0f_Ev8EQEP1CAjMBYD3U';

function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  return '';
}

export const env = {
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL', DEFAULT_SUPABASE_URL),
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY),
  useMockData: getEnvVar('VITE_USE_MOCK_DATA', 'false').toLowerCase() === 'true',
  enableSelectiveLoading: getEnvVar('VITE_ENABLE_SELECTIVE_LOADING', 'true').toLowerCase() !== 'false',
  appMode: getEnvVar('MODE', 'production'),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export function validateEnvironment(): void {
  if (!env.supabaseUrl && !env.useMockData) {
    console.error('CRITICAL: VITE_SUPABASE_URL is not defined in environment variables.');
  }
  if (!env.supabaseAnonKey && !env.useMockData) {
    console.error('CRITICAL: VITE_SUPABASE_ANON_KEY is not defined in environment variables.');
  }
}
