import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError } from '@/shared/utils/errorUtils';

export interface OperationalReportData {
  rows: Record<string, any>[];
  totalCount: number;
  totals: Record<string, number>;
}

export const ReportsService = {
  async loadOperationalReport(
    report: string,
    from: string,
    to: string,
    limit: number,
    offset: number,
  ): Promise<OperationalReportData> {
    const client = requireSupabase();
    const { data, error } = await client.rpc('get_operational_report', {
      p_report: report,
      p_from: from || null,
      p_to: to || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logger.error('Failed to load operational report', error, { module: 'ReportsService', report });
      throw new AppError(error.message || 'Falha ao carregar relatório operacional.');
    }

    const result = (data || {}) as Record<string, any>;
    return {
      rows: result.rows ?? [],
      totalCount: numberValue(result.total_count),
      totals: result.totals ?? {},
    };
  },
};
