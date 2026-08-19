export * from '../lib/branding';

export const DOCUMENT_TYPE_CODES = {
  INVOICE: 'FT',
  INVOICE_RECEIPT: 'FR',
  CASH_SALE: 'VD',
  CREDIT_NOTE: 'NC',
  DEBIT_NOTE: 'ND',
  QUOTATION: 'COT',
  PROFORMA: 'PRO',
  TRANSPORT_GUIDE: 'GR',
  DIRECT_ENTRY: 'ENT',
  DIRECT_EXIT: 'SAI',
  TRANSFER_GUIDE: 'GT',
} as const;

export const PAYMENT_METHODS = [
  { code: 'CASH', label: 'Dinheiro (Numerário)' },
  { code: 'M_PESA', label: 'Vodacom M-Pesa' },
  { code: 'E_MOLA', label: 'Movitel e-Mola' },
  { code: 'POS', label: 'Cartão / POS Terminal' },
  { code: 'BANK_TRANSFER', label: 'Transferência Bancária (BCI/BIM)' },
  { code: 'CREDIT', label: 'A Prazo (Crédito)' },
] as const;

export const PROVINCES_MOZAMBIQUE = [
  'Maputo Cidade',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa',
] as const;
