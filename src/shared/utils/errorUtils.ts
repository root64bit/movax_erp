/**
 * Canonical Application Error Hierarchy and Error Formatting Utilities.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, code, 400);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Acesso não autorizado para esta operação.', code = 'PERMISSION_DENIED') {
    super(message, code, 403);
    this.name = 'PermissionError';
  }
}

export class InventoryError extends AppError {
  constructor(message: string, code = 'INVENTORY_ERROR') {
    super(message, code, 409);
    this.name = 'InventoryError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string, code = 'PAYMENT_ERROR') {
    super(message, code, 402);
    this.name = 'PaymentError';
  }
}

export class SubscriptionError extends AppError {
  constructor(message: string, code = 'SUBSCRIPTION_LIMIT_REACHED') {
    super(message, code, 402);
    this.name = 'SubscriptionError';
  }
}

/**
 * Translates low-level errors into clear Portuguese messages.
 */
export function getFriendlyErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (!error) return fallback;

  if (error instanceof AppError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Credenciais de acesso incorretas. Verifique o email e palavra-passe.';
  }
  if (lower.includes('insufficient_stock') || lower.includes('stock insuficiente')) {
    return 'Stock insuficiente no armazém selecionado para concluir a operação.';
  }
  if (lower.includes('duplicate key') || lower.includes('already exists') || lower.includes('uq_')) {
    return 'Já existe um registo com este código ou identificador no sistema.';
  }
  if (lower.includes('networkerror') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return 'Falha de conexão com o servidor. Verifique o seu acesso à internet.';
  }
  if (lower.includes('jwt expired') || lower.includes('token is expired')) {
    return 'A sua sessão expirou. Por favor inicie sessão novamente.';
  }

  return message || fallback;
}
