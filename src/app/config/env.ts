/**
 * MOVAX ERP / POS - Centralized Environment Configuration
 * Strictly validates and exports environment variables.
 */

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
  supabaseUrl: getEnvVar('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
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
