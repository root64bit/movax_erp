import { useState, useEffect, useCallback } from 'react';
import type { LicenseOverview } from '@/shared/types/domain.types';
import { SubscriptionService } from '../services/subscription.service';
import { logger } from '@/shared/lib/logger';

export function useLicenseOverview() {
  const [overview, setOverview] = useState<LicenseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SubscriptionService.fetchLicenseOverview();
      setOverview(data);
    } catch (err: any) {
      logger.error('Failed to load license overview', err, { module: 'useLicenseOverview' });
      setError(err.message || 'Falha ao carregar dados da licença.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleAddon = async (addonCode: string, currentActive: boolean) => {
    try {
      await SubscriptionService.toggleAddon(addonCode, !currentActive);
      await loadData();
    } catch (err: any) {
      logger.error('Failed to toggle addon', err, { module: 'useLicenseOverview', addonCode });
      throw err;
    }
  };

  return {
    overview,
    loading,
    error,
    refresh: loadData,
    toggleAddon,
  };
}
