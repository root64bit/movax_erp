import { requireSupabase } from '@/integrations/supabase/client';
import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';
import type { PartyInput } from '@/shared/types/domain.types';

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
};
