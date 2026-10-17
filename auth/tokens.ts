import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.AUTH_SECRET ?? 'dev-only-secret';
export const ACCESS_TOKEN_TTL_S = 15 * 60;
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;

export interface TokenClaims {
  sub: string;
  exp: number;
  scope: 'access' | 'refresh';
}

const b64 = (input: string | Buffer) => Buffer.from(input).toString('base64url');

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function issueToken(userId: string, scope: TokenClaims['scope'], now = Date.now()): string {
  const ttl = scope === 'access' ? ACCESS_TOKEN_TTL_S : REFRESH_TOKEN_TTL_S;
  const claims: TokenClaims = { sub: userId, scope, exp: Math.floor(now / 1000) + ttl };
  const payload = b64(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string, scope: TokenClaims['scope'], now = Date.now()): TokenClaims | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenClaims;
  if (claims.scope !== scope) return null;
  if (claims.exp * 1000 < now) return null;
  return claims;
}

/**
 * Exchanges a refresh token for a new access token. The session lookup is a read, so it is
 * retried once if the session store returns a transient error.
 */
export async function refreshAccessToken(
  refreshToken: string,
  lookupSession: (userId: string) => Promise<{ active: boolean }>,
): Promise<string | null> {
  const claims = verifyToken(refreshToken, 'refresh');
  if (!claims) return null;

  let session: { active: boolean };
  try {
    session = await lookupSession(claims.sub);
  } catch {
    session = await lookupSession(claims.sub);
  }
  return session.active ? issueToken(claims.sub, 'access') : null;
}
