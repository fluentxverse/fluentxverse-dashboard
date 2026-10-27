import { expect, test } from 'bun:test';
import { isAdminAuthRequest } from '../src/api/apiClient';

test('only the actual admin authentication endpoints bypass session-expiry handling', () => {
  for (const endpoint of ['login', 'logout', 'me', 'register']) {
    for (const url of [`/admin/${endpoint}`, `/api/admin/${endpoint}`, `https://api.fluentxverse.com/admin/${endpoint}?next=1`, `admin/${endpoint}/`]) {
      expect(isAdminAuthRequest(url)).toBe(true);
    }
  }
});
test('message and management endpoints do not accidentally match the me endpoint', () => {
  for (const url of [undefined, '', '/inbox/admin/messages', '/admin/mail/messages', '/admin/mail/message/123', '/admin/metrics', '/admin/members', '/admin/login-history', '/admin/tutors?next=/admin/me', '/not-admin/me']) {
    expect(isAdminAuthRequest(url)).toBe(false);
  }
});
