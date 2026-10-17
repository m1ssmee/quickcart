type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Level[] = ['debug', 'info', 'warn', 'error'];
const minLevel = (process.env.LOG_LEVEL as Level | undefined) ?? 'info';

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (ORDER.indexOf(level) < ORDER.indexOf(minLevel)) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') console.error(out);
  else console.log(out);
}

export function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  return fn().finally(() => log('debug', `${label} finished`, { ms: Date.now() - started }));
}

const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'card_number', 'cvc']);

/** Replaces sensitive values before they reach the log pipeline. */
export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return out;
}

export function child(context: Record<string, unknown>) {
  return {
    debug: (message: string, fields: Record<string, unknown> = {}) => log('debug', message, { ...context, ...fields }),
    info: (message: string, fields: Record<string, unknown> = {}) => log('info', message, { ...context, ...fields }),
    warn: (message: string, fields: Record<string, unknown> = {}) => log('warn', message, { ...context, ...fields }),
    error: (message: string, fields: Record<string, unknown> = {}) => log('error', message, { ...context, ...fields }),
  };
}
