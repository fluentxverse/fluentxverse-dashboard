import { expect, test } from 'bun:test';
import { MailViewCache, mailMessageKey, updateMailFolders, updateMailPage } from '../src/components/mail/mailViewState';
import type { MailMessage, MailPage } from '../../shared/mail';

const message: MailMessage = { uid: 1, subject: 'Hello', from: [], to: [], cc: [], date: '2026-10-22T00:00:00Z', seen: false, starred: false, hasAttachments: false, messageId: 'one', text: 'Private message', references: [], attachments: [] };
const data: MailPage = { messages: [message], page: 1, pages: 1, total: 1, uidValidity: '42' };
const view = { accountId: 'personal', folder: 'INBOX', page: 1, search: '', filter: 'all' };

test('read/star changes update a page without changing totals or replacing unrelated rows', () => {
  const starred = updateMailPage(data, 'star', [1], 'all', [message]);
  expect(starred.messages[0]?.starred).toBe(true); expect(starred.total).toBe(1);
  expect(data.messages[0]?.starred).toBe(false);
  expect(updateMailPage(data, 'read', [1], 'unread', [message])).toMatchObject({ messages: [], total: 0, pages: 1 });
  expect(updateMailPage(starred, 'unstar', [1], 'starred', starred.messages)).toMatchObject({ messages: [], total: 0 });
  expect(updateMailPage(data, 'trash', [1], 'all', [message])).toMatchObject({ messages: [], total: 0 });
});

test('folder badges account for changed read state and moved messages only', () => {
  const folders = [{ path: 'INBOX', name: 'Inbox', role: 'inbox', total: 10, unread: 3 }, { path: 'Trash', name: 'Trash', role: 'trash', total: 0, unread: 0 }];
  const read = updateMailFolders(folders, 'INBOX', undefined, 'read', [message]);
  expect(read[0]).toMatchObject({ total: 10, unread: 2 });
  expect(updateMailFolders(read, 'INBOX', undefined, 'read', [{ ...message, seen: true }])[0]?.unread).toBe(2);
  expect(updateMailFolders(folders, 'INBOX', 'Trash', 'trash', [message])).toMatchObject([{ total: 9, unread: 2 }, { total: 1, unread: 1 }]);
});

test('cache keys isolate accounts, folders, searches, filters, pages and UID validity', () => {
  const cache = new MailViewCache(); cache.storePage(view, data);
  expect(cache.page(view)).toBe(data);
  for (const different of [{ accountId: 'support' }, { folder: 'Sent' }, { search: 'other' }, { filter: 'unread' }, { page: 2 }]) expect(cache.page({ ...view, ...different })).toBeUndefined();
  const key = mailMessageKey('personal', 'INBOX', '42', 1);
  cache.storeMessage(key, message);
  expect(cache.message(mailMessageKey('support', 'INBOX', '42', 1))).toBeUndefined();
  expect(cache.message(mailMessageKey('personal', 'INBOX', '43', 1))).toBeUndefined();
  cache.invalidateFolder('personal', 'INBOX'); expect(cache.page(view)).toBeUndefined();
  cache.clear(); expect(cache.message(key)).toBeUndefined();
});

test('an in-flight message response cannot overwrite a just-completed read/star action', () => {
  let now = 0; const cache = new MailViewCache(() => now), key = mailMessageKey('personal', 'INBOX', '42', 1);
  cache.patch(key, 'read'); cache.patch(key, 'star');
  expect(cache.storeMessage(key, message)).toMatchObject({ seen: true, starred: true });
  now = 61_000; expect(cache.message(key)).toMatchObject({ seen: true, starred: true });
  expect(cache.storeMessage(key, message)).toMatchObject({ seen: false, starred: false });
});

test('a late page refill preserves read/star updates, filtering and account isolation', () => {
  const cache = new MailViewCache(), key = mailMessageKey('personal', 'INBOX', '42', 1);
  cache.patch(key, 'read'); cache.patch(key, 'star');
  expect(cache.reconcilePage(view, data)).toMatchObject({ total: 1, messages: [{ seen: true, starred: true }] });
  expect(cache.reconcilePage({ ...view, filter: 'unread' }, data)).toMatchObject({ total: 0, messages: [] });
  expect(cache.reconcilePage({ ...view, accountId: 'support' }, data).messages[0]?.seen).toBe(false);
});

test('private message caching is bounded and expires instead of persisting indefinitely', () => {
  let now = 0; const cache = new MailViewCache(() => now), key = mailMessageKey('personal', 'INBOX', '42', 1);
  cache.storePage(view, data); cache.storeMessage(key, message);
  now = 60_001; expect(cache.page(view)).toBeUndefined(); expect(cache.message(key)).toBeDefined();
  now = 300_001; expect(cache.message(key)).toBeUndefined();
  for (let page = 1; page <= 13; page++) cache.storePage({ ...view, page }, data);
  expect(cache.page(view)).toBeUndefined();
  for (let uid = 1; uid <= 21; uid++) cache.storeMessage(mailMessageKey('personal', 'INBOX', '42', uid), { ...message, uid });
  expect(cache.message(key)).toBeUndefined();
  cache.storeMessage(key, { ...message, text: 'x'.repeat(2_500_001) }); expect(cache.message(key)).toBeUndefined();
});
