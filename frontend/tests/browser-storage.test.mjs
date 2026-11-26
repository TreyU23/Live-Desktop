import test from 'node:test';
import assert from 'node:assert/strict';
import { removeStoredItem, storeItem } from '../src/browserStorage.js';

function fakeStorage({ full = false } = {}) {
  const items = new Map();
  return {
    items,
    setItem(key, value) {
      if (full) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      items.set(key, String(value));
    },
    removeItem(key) {
      if (full) throw new Error('storage unavailable');
      items.delete(key);
    },
  };
}

test('storage writes report success', () => {
  const storage = fakeStorage();
  assert.equal(storeItem(storage, 'theme', 'dark'), true);
  assert.equal(storage.items.get('theme'), 'dark');
  assert.equal(removeStoredItem(storage, 'theme'), true);
  assert.equal(storage.items.has('theme'), false);
});

test('a full or unavailable storage reports failure instead of throwing', () => {
  const storage = fakeStorage({ full: true });
  assert.equal(storeItem(storage, 'theme', 'dark'), false);
  assert.equal(removeStoredItem(storage, 'theme'), false);
});
