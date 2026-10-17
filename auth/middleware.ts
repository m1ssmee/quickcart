import { verifyToken } from './tokens';

export interface AuthenticatedUser {
  id: string;
}

// Short-lived cache of verified tokens to avoid repeating HMAC checks on hot paths.
const cache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 10_000;

export async function authenticate(header: string | undefined, now = Date.now()): Promise<AuthenticatedUser | null> {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();

  const cached = cache.get(token);
  if (cached && cached.expiresAt > now) return cached.user;

  const claims = verifyToken(token, 'access', now);
  if (!claims) {
    cache.delete(token);
    return null;
  }

  const user = { id: claims.sub };
  // Never cache past the token's own expiry.
  const expiresAt = Math.min(now + CACHE_TTL_MS, claims.exp * 1000);
  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  cache.set(token, { user, expiresAt });
  return user;
}

export function clearAuthCache(): void {
  cache.clear();
}

const ADMIN_USERS = new Set((process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean));

export function isAdmin(user: AuthenticatedUser | null): boolean {
  return !!user && ADMIN_USERS.has(user.id);
}

export async function requireAdmin(header: string | undefined): Promise<AuthenticatedUser> {
  const user = await authenticate(header);
  if (!user || !isAdmin(user)) throw new Error('forbidden');
  return user;
}
