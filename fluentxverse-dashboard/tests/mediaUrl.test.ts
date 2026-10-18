import { expect, test } from 'bun:test';
import { mediaUrl } from '../src/utils/mediaUrl';

const base = 'https://api.fluentxverse.com';
test('session photos route storage and legacy API paths through the public media proxy', () => {
  for (const source of [
    '/user/tutor/profile/photo.png?t=1',
    'http://fluentxverse-seaweed-filer:8888/user/tutor/profile/photo.png?t=1',
    'http://seaweed-filer:8888/user/tutor/profile/photo.png?t=1',
    'http://localhost:8888/user/tutor/profile/photo.png?t=1',
    'http://127.0.0.1:8888/user/tutor/profile/photo.png?t=1',
    'https://api.fluentxverse.xyz/user/tutor/profile/photo.png?t=1',
    'https://api.fluentxverse.xyz/lesson/files/user/tutor/profile/photo.png?t=1',
    'https://api.fluentxverse.com/lesson/files/user/tutor/profile/photo.png?t=1',
  ]) expect(mediaUrl(source, `${base}/`)).toBe(`${base}/lesson/files/user/tutor/profile/photo.png?t=1`);
  expect(mediaUrl('/lesson/files/user/student/photo.png', base)).toBe(`${base}/lesson/files/user/student/photo.png`);
});
test('session photos keep valid external images and previews intact', () => {
  for (const source of ['https://images.example.test/user/photo.png', '/assets/avatar.png', 'blob:https://dashboard.fluentxverse.com/example', 'data:image/png;base64,AA==']) {
    expect(mediaUrl(source, base)).toBe(source);
  }
  expect(mediaUrl(undefined, base)).toBeUndefined();
  expect(mediaUrl('', base)).toBeUndefined();
  expect(mediaUrl('   ', base)).toBeUndefined();
});
test('only recognized storage origins are proxied', () => {
  for (const source of ['https://api.fluentxverse.com.evil.test/user/photo.png', 'https://api.fluentxverse.xyz:444/user/photo.png', 'https://name:pass@api.fluentxverse.xyz/user/photo.png']) {
    expect(mediaUrl(source, base)).toBe(source);
  }
});
