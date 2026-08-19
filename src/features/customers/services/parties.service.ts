import { requireSupabase } from '@/integrations/supabase/client';
import { numberValue } from '@/integrations/supabase/helpers';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { Client, Supplier, PartyInput } from '@/shared/types/domain.types';

export const PartiesService = {
  async createCustomer(input: PartyInput): Promise<void> {
    if (!input.number.trim()) throw new ValidationError('O código de cliente é obrigatório.');
    if (!input.name.trim()) throw new ValidationError('O nome do cliente é obrigatório.');

    const client = requireSupabase();
    const cleanNumber = input.number.toUpperCase().trim();
    const cleanName = input.name.trim();

    const { error } = await client.rpc('create_operational_customer', {
      p_customer: {
        number: cleanNumber,
        name: cleanName,
        tax_number: input.taxNumber || null,
        telephone: input.telephone || null,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        credit_limit: input.creditLimit || 0,
        payment_term_code: input.paymentTermCode || 'DINHEIRO',
      },
    });

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('uq_customer')) {
        throw new ValidationError(`O código de cliente "${input.number}" já existe.`);
      }
      logger.error('Failed to create customer', error, { module: 'PartiesService', number: input.number });
      throw new AppError(error.message || 'Falha ao guardar cliente.');
    }
  },

  async createSupplier(input: PartyInput): Promise<void> {
    if (!input.number.trim()) throw new ValidationError('O código do fornecedor é obrigatório.');
    if (!input.name.trim()) throw new ValidationError('O nome do fornecedor é obrigatório.');

    const client = requireSupabase();
    const cleanNumber = input.number.toUpperCase().trim();
    const cleanName = input.name.trim();

    const { error } = await client.rpc('create_operational_supplier', {
      p_supplier: {
        number: cleanNumber,
        name: cleanName,
        tax_number: input.taxNumber || null,
        telephone: input.telephone || null,
        email: input.email || null,
        address: input.address || null,
        city: input.city || null,
        contact_person: input.contactPerson || null,
        credit_limit: input.creditLimit || 0,
        payment_term_code: input.paymentTermCode || 'DINHEIRO',
      },
    });

    if (error) {
      if (error.message.includes('duplicate key') || error.message.includes('uq_supplier')) {
        throw new ValidationError(`O código de fornecedor "${input.number}" já existe.`);
      }
      logger.error('Failed to create supplier', error, { module: 'PartiesService', number: input.number });
      throw new AppError(error.message || 'Falha ao guardar fornecedor.');
    }
  },

  async updateParty(
    type: 'customer' | 'supplier',
    partyId: string,
    input: PartyInput,
    active = true,
  ): Promise<void> {
    const client = requireSupabase();
    const { error } = await client.rpc('admin_update_operational_party', {
      p_party_type: type.toUpperCase(),
      p_party_id: partyId,
      p_data: {
        number: input.number.trim(),
        name: input.name.trim(),
        tax_number: input.taxNumber?.trim() || null,
        telephone: input.telephone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        contact_person: input.contactPerson?.trim() || null,
      },
      p_active: active,
    });

    if (error) {
      if (error.message.includes('WALK_IN_CUSTOMER_CANNOT_BE_DEACTIVATED')) {
        throw new ValidationError('O Cliente Pontual (código 1) é obrigatório e não pode ser apagado.');
      }
      if (error.message.includes('duplicate key')) {
        throw new ValidationError(`O código "${input.number}" já está em uso.`);
      }
      logger.error('Failed to update party', error, { module: 'PartiesService', partyId, type });
      throw new AppError(error.message || `Falha ao actualizar ${type === 'customer' ? 'cliente' : 'fornecedor'}.`);
    }
  },

  async fetchCustomersPage(params: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: Client[]; totalCount: number }> {
    const client = requireSupabase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = client
      .from('customers')
      .select('id,customer_number,name,tax_number,telephone,email,current_balance,customer_addresses(address_line_1,is_primary)', { count: 'exact' })
      .eq('active', true);

    if (params.search?.trim()) {
      const term = params.search.trim();
      query = query.or(`name.ilike.%${term}%,customer_number.ilike.%${term}%,tax_number.ilike.%${term}%,telephone.ilike.%${term}%`);
    }

    const { data, count, error } = await query
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch customers page', error, { module: 'PartiesService' });
      throw new AppError(error.message || 'Falha ao carregar clientes.');
    }

    const rows: Client[] = (data || []).map((row: any) => {
      const primaryAddress = Array.isArray(row.customer_addresses)
        ? row.customer_addresses.find((addr: any) => addr.is_primary)?.address_line_1 ?? row.customer_addresses[0]?.address_line_1
        : undefined;
      return {
        id: String(row.id),
        code: String(row.customer_number ?? ''),
        number: String(row.customer_number ?? ''),
        name: String(row.name ?? ''),
        nuit: row.tax_number ? String(row.tax_number) : '',
        phone: row.telephone ? String(row.telephone) : '',
        email: row.email ? String(row.email) : '',
        address: primaryAddress || '',
        pendingBalance: numberValue(row.current_balance),
      };
    });

    return { rows, totalCount: count ?? rows.length };
  },

  async fetchSuppliersPage(params: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: Supplier[]; totalCount: number }> {
    const client = requireSupabase();
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = client
      .from('suppliers')
      .select('id,supplier_number,name,tax_number,telephone,email,contact_person,current_balance,supplier_addresses(address_line_1,is_primary)', { count: 'exact' })
      .eq('active', true);

    if (params.search?.trim()) {
      const term = params.search.trim();
      query = query.or(`name.ilike.%${term}%,supplier_number.ilike.%${term}%,tax_number.ilike.%${term}%,telephone.ilike.%${term}%`);
    }

    const { data, count, error } = await query
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch suppliers page', error, { module: 'PartiesService' });
      throw new AppError(error.message || 'Falha ao carregar fornecedores.');
    }

    const rows: Supplier[] = (data || []).map((row: any) => {
      const primaryAddress = Array.isArray(row.supplier_addresses)
        ? row.supplier_addresses.find((addr: any) => addr.is_primary)?.address_line_1 ?? row.supplier_addresses[0]?.address_line_1
        : undefined;
      return {
        id: String(row.id),
        code: String(row.supplier_number ?? ''),
        number: String(row.supplier_number ?? ''),
        name: String(row.name ?? ''),
        nuit: row.tax_number ? String(row.tax_number) : '',
        phone: row.telephone ? String(row.telephone) : '',
        email: row.email ? String(row.email) : '',
        address: primaryAddress || '',
        contactPerson: row.contact_person ? String(row.contact_person) : '',
        totalPurchases: numberValue(row.current_balance),
        pendingBalance: numberValue(row.current_balance),
      };
    });

    return { rows, totalCount: count ?? rows.length };
  },

  async searchCustomers(query: string, limit = 20): Promise<Client[]> {
    const res = await this.fetchCustomersPage({ search: query, limit, offset: 0 });
    return res.rows;
  },

  async searchSuppliers(query: string, limit = 20): Promise<Supplier[]> {
    const res = await this.fetchSuppliersPage({ search: query, limit, offset: 0 });
    return res.rows;
  },
};
