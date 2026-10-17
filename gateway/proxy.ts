import { UPSTREAM_TIMEOUT_MS, type ServiceConfig } from './config';
import { log } from '../utils/logger';

export class UpstreamTimeoutError extends Error {
  constructor(public readonly service: string) {
    super(`Upstream ${service} did not respond within ${UPSTREAM_TIMEOUT_MS}ms`);
    this.name = 'UpstreamTimeoutError';
  }
}

export class UpstreamError extends Error {
  constructor(public readonly service: string, public readonly status: number, body: string) {
    super(`Upstream ${service} returned ${status}: ${body.slice(0, 200)}`);
    this.name = 'UpstreamError';
  }
}

export interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Forwards a request to an internal service and returns the parsed JSON response.
 * The call is aborted after UPSTREAM_TIMEOUT_MS.
 */
export async function forward<T>(service: ServiceConfig, req: ProxyRequest): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(service.baseUrl + req.path, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', ...req.headers },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: controller.signal,
    });
    const text = await res.text();
    log('debug', 'upstream response', { service: service.name, status: res.status, ms: Date.now() - started });
    if (!res.ok) throw new UpstreamError(service.name, res.status, text);
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      log('warn', 'upstream timeout', { service: service.name, path: req.path, ms: Date.now() - started });
      throw new UpstreamTimeoutError(service.name);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function statusFor(err: unknown): number {
  if (err instanceof UpstreamTimeoutError) return 504;
  if (err instanceof UpstreamError) return err.status >= 500 ? 502 : err.status;
  return 500;
}
