/**
 * Safe, structured production logger for Movax ERP.
 * Automatically redacts sensitive fields (passwords, tokens, keys) and logs in structured JSON format.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  companyId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'service_role_key',
  'anon_key',
  'authorization',
  'cookie',
]);

function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const timestamp = new Date().toISOString();
  const sanitized = redactSensitiveData(context || {}) as Record<string, unknown>;
  const entry: Record<string, unknown> = {
    timestamp,
    level,
    message,
    ...(typeof sanitized === 'object' && sanitized !== null ? sanitized : {}),
  };

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    } else {
      entry.error = String(error);
    }
  }

  return entry;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = formatLogEntry('debug', message, context);
      console.debug(`[DEBUG] ${message}`, entry);
    }
  },

  info(message: string, context?: LogContext): void {
    const entry = formatLogEntry('info', message, context);
    console.info(`[INFO] ${message}`, entry);
  },

  warn(message: string, context?: LogContext): void {
    const entry = formatLogEntry('warn', message, context);
    console.warn(`[WARN] ${message}`, entry);
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    const entry = formatLogEntry('error', message, context, error);
    console.error(`[ERROR] ${message}`, entry);
  },
};
