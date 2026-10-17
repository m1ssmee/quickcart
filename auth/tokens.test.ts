import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken, refreshAccessToken } from './tokens';

test('issued access tokens verify', () => {
  const token = issueToken('user_1', 'access');
  assert.equal(verifyToken(token, 'access')?.sub, 'user_1');
});

test('scope is enforced', () => {
  const token = issueToken('user_1', 'refresh');
  assert.equal(verifyToken(token, 'access'), null);
});

test('expired tokens are rejected', () => {
  const issuedAt = Date.now() - 60 * 60 * 1000;
  const token = issueToken('user_1', 'access', issuedAt);
  assert.equal(verifyToken(token, 'access'), null);
});

test('tampered tokens are rejected', () => {
  const token = issueToken('user_1', 'access');
  const [payload] = token.split('.');
  assert.equal(verifyToken(`${payload}.not-a-signature`, 'access'), null);
});

test('refresh retries the session lookup once', async () => {
  let calls = 0;
  const lookup = async () => {
    calls++;
    if (calls === 1) throw new Error('transient');
    return { active: true };
  };
  const token = await refreshAccessToken(issueToken('user_1', 'refresh'), lookup);
  assert.ok(token);
  assert.equal(calls, 2);
});

test('inactive sessions do not refresh', async () => {
  const token = await refreshAccessToken(issueToken('user_1', 'refresh'), async () => ({ active: false }));
  assert.equal(token, null);
});
