// Gateway configuration. Values can be overridden with environment variables.

export interface ServiceConfig {
  name: string;
  baseUrl: string;
}

export const SERVICES: Record<string, ServiceConfig> = {
  auth: { name: 'auth', baseUrl: process.env.AUTH_URL ?? 'http://localhost:4001' },
  orders: { name: 'orders', baseUrl: process.env.ORDERS_URL ?? 'http://localhost:4002' },
  payments: { name: 'payments', baseUrl: process.env.PAYMENTS_URL ?? 'http://localhost:4003' },
  inventory: { name: 'inventory', baseUrl: process.env.INVENTORY_URL ?? 'http://localhost:4004' },
};

// Maximum time the gateway waits for any upstream service before failing the request.
export const UPSTREAM_TIMEOUT_MS = 2000;

// Requests larger than this are rejected before they reach a service.
export const MAX_BODY_BYTES = 256 * 1024;

export const PORT = Number(process.env.PORT ?? 4000);

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function serviceFor(path: string): ServiceConfig | undefined {
  const [, prefix] = path.split('/');
  return SERVICES[prefix];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

// Paths the load balancer polls; they bypass authentication and logging.
export const HEALTH_PATHS = ['/healthz', '/readyz'];

export function isHealthCheck(path: string): boolean {
  return HEALTH_PATHS.includes(path);
}
