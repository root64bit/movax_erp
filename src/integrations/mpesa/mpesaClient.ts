import { logger } from '@/shared/lib/logger';
import { PaymentError } from '@/shared/utils/errorUtils';

export interface MpesaPaymentRequest {
  phoneNumber: string;
  amount: number;
  reference: string;
  transactionDesc?: string;
}

export interface MpesaPaymentResponse {
  success: boolean;
  transactionId?: string;
  conversationId?: string;
  responseCode: string;
  responseDesc: string;
}

export const MpesaClient = {
  isAvailable(): boolean {
    return true;
  },

  async initiateC2B(request: MpesaPaymentRequest): Promise<MpesaPaymentResponse> {
    const cleanPhone = request.phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      throw new PaymentError('Número de telefone M-Pesa inválido. Deve ter 9 dígitos (ex: 84xxxxxxx).');
    }
    if (request.amount <= 0) {
      throw new PaymentError('O valor do pagamento deve ser superior a zero.');
    }

    logger.info('Initiating M-Pesa C2B payment', {
      module: 'MpesaClient',
      phone: cleanPhone.slice(0, 4) + '*****',
      amount: request.amount,
      reference: request.reference,
    });

    // Mock/Edge function integration placeholder for M-Pesa sandbox/production
    return {
      success: true,
      transactionId: 'MP' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      conversationId: 'CONV-' + Date.now(),
      responseCode: 'INS-0',
      responseDesc: 'Pedido de pagamento enviado com sucesso para o telemóvel do cliente.',
    };
  },
};
