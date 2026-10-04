import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCookie, verifySessionCookie } from '../security.js';

test('session cookies preserve the authenticated user identity', () => {
  const cookie = createSessionCookie('user-123');
  const session = verifySessionCookie(cookie);
  assert.equal(session.userId, 'user-123');
  assert.ok(session.expires > Date.now());
});

test('tampered session cookies are rejected', () => {
  const cookie = createSessionCookie('user-123');
  const parts = cookie.split('.');
  const tampered = 'user-999:' + parts[0].split(':').pop() + '.' + parts[1];
  assert.equal(verifySessionCookie(tampered), null);
});
