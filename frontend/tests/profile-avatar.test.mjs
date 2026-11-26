import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarError, checkPhotoFile, coverCrop, kMaxPhotoBytes } from '../src/profileAvatar.js';

test('profile photos must be images under the size limit (issue #29)', () => {
  assert.doesNotThrow(() => checkPhotoFile({ type: 'image/jpeg', size: 4 * 1024 * 1024 }));
  assert.throws(() => checkPhotoFile({ type: 'text/plain', size: 10 }), AvatarError);
  assert.throws(() => checkPhotoFile(null), AvatarError);
  assert.throws(() => checkPhotoFile({ type: 'image/png', size: kMaxPhotoBytes + 1 }), AvatarError);
});

test('avatar crop is a centered square', () => {
  assert.deepEqual(coverCrop(4032, 3024), { sx: 504, sy: 0, side: 3024 });
  assert.deepEqual(coverCrop(1080, 1920), { sx: 0, sy: 420, side: 1080 });
  assert.deepEqual(coverCrop(256, 256), { sx: 0, sy: 0, side: 256 });
});
