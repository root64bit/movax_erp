export interface FeatureFlags {
  enableSelectiveLoading: boolean;
  enableOfflineSync: boolean;
  enableMpesaIntegration: boolean;
  enableAdvancedAnalytics: boolean;
}

export const featureFlags: FeatureFlags = {
  enableSelectiveLoading: String(import.meta.env.VITE_ENABLE_SELECTIVE_LOADING ?? 'true').toLowerCase() !== 'false',
  enableOfflineSync: false,
  enableMpesaIntegration: true,
  enableAdvancedAnalytics: true,
};
