import { serviceFor, isAllowedOrigin, MAX_BODY_BYTES } from './config';
import { forward, statusFor, type ProxyRequest } from './proxy';
import { authenticate } from '../auth/middleware';
import { log } from '../utils/logger';

export interface IncomingRequest extends ProxyRequest {
  origin?: string;
  authorization?: string;
  contentLength?: number;
}

export interface OutgoingResponse {
  status: number;
  body: unknown;
}

const PUBLIC_PATHS = new Set(['/auth/login', '/auth/refresh', '/inventory/products']);

export async function handle(req: IncomingRequest): Promise<OutgoingResponse> {
  if (!isAllowedOrigin(req.origin)) {
    return { status: 403, body: { error: 'origin not allowed' } };
  }
  if ((req.contentLength ?? 0) > MAX_BODY_BYTES) {
    return { status: 413, body: { error: 'request body too large' } };
  }

  const service = serviceFor(req.path);
  if (!service) return { status: 404, body: { error: 'not found' } };

  const headers: Record<string, string> = {};
  if (!PUBLIC_PATHS.has(req.path)) {
    const user = await authenticate(req.authorization);
    if (!user) return { status: 401, body: { error: 'unauthorized' } };
    headers['x-user-id'] = user.id;
  }

  try {
    const body = await forward(service, { ...req, headers });
    return { status: 200, body };
  } catch (err) {
    const status = statusFor(err);
    log('error', 'request failed', { path: req.path, status, error: String(err) });
    return { status, body: { error: status === 504 ? 'upstream timeout' : 'upstream error' } };
  }
}

// TODO: add per-client rate limiting before the public launch
