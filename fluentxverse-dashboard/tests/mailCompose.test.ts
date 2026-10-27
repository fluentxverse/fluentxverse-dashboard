import { expect, test } from 'bun:test';
import { safeComposeLink } from '../src/components/mail/mailCompose';

test('compose links allow ordinary web and email URLs without executable schemes or credentials', () => {
  expect(safeComposeLink('https://fluentxverse.com')).toBe('https://fluentxverse.com/');
  expect(safeComposeLink(' http://example.test/lesson ')).toBe('http://example.test/lesson');
  expect(safeComposeLink('mailto:support@fluentxverse.com')).toBe('mailto:support@fluentxverse.com');
  for (const input of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', '//example.test', 'https://user:secret@example.test', 'not a link']) expect(safeComposeLink(input)).toBe('');
});
