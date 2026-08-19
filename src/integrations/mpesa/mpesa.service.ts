/**
 * M-Pesa Payment Gateway Integration (MineScope API)
 * Provider: Vodacom M-Pesa Moçambique via MineScope Cloud Gateway
 * Base URL: https://minescoop-mz.web.app/api/mpesa
 */

import { logger } from '@/shared/lib/logger';
import { AppError, ValidationError } from '@/shared/utils/errorUtils';

const MPESA_BASE_URL = 'https://minescoop-mz.web.app/api/mpesa';

export interface MpesaPayRequest {
  amount: number;
  msisdn: string;
  reference?: string;
  thirdPartyRef?: string;
}

export interface MpesaPayResponse {
  success: boolean;
  transactionId?: string | null;
  conversationId?: string;
  responseCode: string;
  responseDescription: string;
  thirdPartyRef?: string;
  firestoreDocId?: string;
  timestamp?: string;
}

export interface MpesaStatusRequest {
  queryRef: string;
  thirdPartyRef: string;
}

export interface MpesaStatusResponse {
  success: boolean;
  responseCode: string;
  responseDescription: string;
  conversationId?: string;
  transactionStatus?: 'Completed' | 'Failed' | 'Pending' | string;
  timestamp?: string;
}

export interface MpesaReversalRequest {
  transactionId: string;
  amount: number;
  thirdPartyRef: string;
}

export interface MpesaReversalResponse {
  success: boolean;
  responseCode: string;
  responseDescription: string;
  transactionId?: string;
  conversationId?: string;
  timestamp?: string;
}

export const MPESA_ERROR_MESSAGES: Record<string, string> = {
  'INS-0': 'Transação processada com sucesso.',
  'INS-1': 'Erro interno no gateway M-Pesa. Por favor tente novamente.',
  'INS-2': 'Limite de transação diário/mensal excedido.',
  'INS-4': 'Dados inválidos fornecidos no pedido de pagamento.',
  'INS-5': 'Transação cancelada pelo utilizador no telemóvel.',
  'INS-6': 'Falha na transação M-Pesa.',
  'INS-9': 'Tempo limite excedido. O cliente não inseriu o PIN a tempo.',
  'INS-10': 'Saldo insuficiente na conta M-Pesa.',
  'INS-13': 'Referência duplicada ou inválida.',
  'INS-15': 'Número de telefone M-Pesa inválido.',
  'INS-17': 'Referência de transação inválida.',
  'INS-20': 'Montante de pagamento inválido.',
  'INS-21': 'Utilizador M-Pesa não encontrado.',
  'INS-22': 'Conta M-Pesa não está ativa.',
  'INS-23': 'Transação não autorizada.',
  'INS-24': 'Montante acima do limite permitido por transação.',
  'INS-25': 'Transação duplicada já processada anteriormente.',
  'INS-994': 'Limite de chamadas à API excedido.',
  'INS-999': 'Erro de autenticação no gateway M-Pesa.',
  'INS-2001': 'Iniciador de pagamento inválido.',
  'INS-2006': 'Transação original não encontrada para estorno.',
  'INS-2051': 'Número de telefone não está registado no M-Pesa.',
};

/**
 * Normalizes phone numbers to standard 25884xxxxxxx / 25885xxxxxxx format.
 */
export function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('258') && digits.length === 12) {
    return digits;
  }
  if (digits.length === 9) {
    return `258${digits}`;
  }
  return digits;
}

/**
 * Validates whether a phone number is a valid Mozambican MSISDN (2588xxxxxxxx).
 */
export function validateMsisdn(phone: string): boolean {
  const normalized = normalizeMsisdn(phone);
  return /^258\d{9}$/.test(normalized);
}

/**
 * Generates an alphanumeric reference without hyphens (max 10 chars) as required by M-Pesa gateway.
 */
export function generateMpesaRef(prefix = 'MV'): string {
  const cleanPrefix = prefix.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 2);
  const timePart = Date.now().toString(36).toUpperCase().slice(-4);
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const res = `${cleanPrefix}${timePart}${randPart}`.replace(/[^A-Z0-9]/g, '');
  return res.slice(0, 10);
}

export const MpesaService = {
  /**
   * Initiates a C2B Payment (Customer to Business via Push USSD).
   * Customer receives an interactive prompt on their phone to input their M-Pesa PIN.
   */
  async initiateC2BPayment(params: MpesaPayRequest): Promise<MpesaPayResponse> {
    const normalizedPhone = normalizeMsisdn(params.msisdn);
    if (!validateMsisdn(normalizedPhone)) {
      throw new ValidationError(
        'Número M-Pesa inválido. Utilize um número de Moçambique válido (ex: 84 123 4567 ou 85 123 4567).'
      );
    }

    if (params.amount <= 0) {
      throw new ValidationError('O valor do pagamento deve ser superior a zero.');
    }

    const ref = (params.reference || generateMpesaRef('T')).replace(/[^A-Z0-9]/gi, '').slice(0, 10);
    const thirdPartyRef = (params.thirdPartyRef || generateMpesaRef('MS')).replace(/[^A-Z0-9]/gi, '').slice(0, 10);

    const payload = {
      amount: Math.round(params.amount * 100) / 100,
      msisdn: normalizedPhone,
      reference: ref,
      thirdPartyRef: thirdPartyRef,
    };

    logger.info('Initiating M-Pesa C2B payment request', {
      module: 'MpesaService',
      amount: payload.amount,
      msisdn: payload.msisdn,
      reference: payload.reference,
      thirdPartyRef: payload.thirdPartyRef,
    });

    try {
      const response = await fetch(`${MPESA_BASE_URL}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: MpesaPayResponse = await response.json();

      if (!response.ok || !data.success) {
        const friendlyMessage =
          MPESA_ERROR_MESSAGES[data.responseCode] ||
          data.responseDescription ||
          'Falha ao processar pagamento via M-Pesa.';

        logger.warn('M-Pesa C2B payment rejected', {
          module: 'MpesaService',
          code: data.responseCode,
          description: data.responseDescription,
        });

        throw new AppError(friendlyMessage, data.responseCode);
      }

      logger.info('M-Pesa C2B payment successful', {
        module: 'MpesaService',
        transactionId: data.transactionId,
        conversationId: data.conversationId,
      });

      return data;
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof AppError) {
        throw err;
      }
      logger.error('M-Pesa payment network error', err, { module: 'MpesaService' });
      throw new AppError(
        'Não foi possível comunicar com o gateway M-Pesa. Verifique a sua ligação à internet.',
        'NETWORK_ERROR'
      );
    }
  },

  /**
   * Queries the status of an initiated M-Pesa transaction.
   */
  async queryStatus(queryRef: string, thirdPartyRef: string): Promise<MpesaStatusResponse> {
    const payload: MpesaStatusRequest = {
      queryRef: queryRef.replace(/[^A-Z0-9]/gi, '').slice(0, 10),
      thirdPartyRef: thirdPartyRef.replace(/[^A-Z0-9]/gi, '').slice(0, 10),
    };

    try {
      const response = await fetch(`${MPESA_BASE_URL}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: MpesaStatusResponse = await response.json();
      return data;
    } catch (err: any) {
      logger.error('M-Pesa query status error', err, { module: 'MpesaService' });
      throw new AppError('Falha ao consultar estado da transação M-Pesa.');
    }
  },

  /**
   * Requests a reversal / refund of an existing completed transaction.
   */
  async reverseTransaction(transactionId: string, amount: number, thirdPartyRef?: string): Promise<MpesaReversalResponse> {
    const payload: MpesaReversalRequest = {
      transactionId,
      amount: Math.round(amount * 100) / 100,
      thirdPartyRef: (thirdPartyRef || generateMpesaRef('RV')).replace(/[^A-Z0-9]/gi, '').slice(0, 10),
    };

    try {
      const response = await fetch(`${MPESA_BASE_URL}/reversal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: MpesaReversalResponse = await response.json();
      if (!response.ok || !data.success) {
        const friendlyMessage =
          MPESA_ERROR_MESSAGES[data.responseCode] ||
          data.responseDescription ||
          'Falha ao estornar transação M-Pesa.';
        throw new AppError(friendlyMessage, data.responseCode);
      }
      return data;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error('M-Pesa reversal error', err, { module: 'MpesaService' });
      throw new AppError('Falha ao comunicar com o gateway para estorno.');
    }
  },
};
