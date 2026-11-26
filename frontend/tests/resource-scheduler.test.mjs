import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceScheduler } from '../src/resourceScheduler.js';

test('independent resources commit immediately and manual reads deduplicate', async () => {
  let resolveSlow; let calls = 0; const commits = [];
  const scheduler = createResourceScheduler({ read: path => { calls++; return path === 'slow' ? new Promise(resolve => { resolveSlow = resolve; }) : Promise.resolve(path); } });
  scheduler.register('slow', { path: 'slow', apply: value => commits.push(value) });
  scheduler.register('fast', { path: 'fast', apply: value => commits.push(value) });
  const slow = scheduler.refresh('slow');
  assert.equal(scheduler.refresh('slow'), slow);
  await scheduler.refresh('fast');
  assert.deepEqual(commits, ['fast']); assert.equal(calls, 2);
  resolveSlow('slow'); await slow; scheduler.stop();
});

test('invalidation and teardown prevent late commits even when transport ignores abort', async () => {
  let resolve; const commits = [];
  const scheduler = createResourceScheduler({ read: () => new Promise(done => { resolve = done; }) });
  scheduler.register('profile', { path: '/profile', apply: value => commits.push(value) });
  const read = scheduler.refresh('profile'); await Promise.resolve();
  const invalidated = scheduler.invalidate('profile'); resolve('old profile');
  await read; await invalidated; assert.deepEqual(commits, []); scheduler.stop();
});

test('visibility pauses polling and returning while a read is pending does not duplicate it', async () => {
  let hidden = false; let calls = 0; let resolve;
  const timers = new Map(); let sequence = 0;
  const clock = { setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id) };
  const scheduler = createResourceScheduler({ read: () => { calls++; return new Promise(done => { resolve = done; }); }, visible: () => !hidden, clock });
  scheduler.register('phone', { path: '/phone', apply: () => {} });
  scheduler.visibilityChanged(); await Promise.resolve();
  hidden = true; scheduler.visibilityChanged(); hidden = false; scheduler.visibilityChanged();
  assert.equal(calls, 1); resolve({}); await scheduler.refresh('phone');
  assert.equal(timers.size, 1); hidden = true; scheduler.visibilityChanged(); assert.equal(timers.size, 0); scheduler.stop();
});

test('forget drops the cached value of a key', async () => {
  let fail = false; const statuses = [];
  const scheduler = createResourceScheduler({
    read: () => fail ? Promise.reject(new Error('gone')) : Promise.resolve({ id: 'chat' }),
    status: (key, value) => statuses.push(value),
  });
  scheduler.register('conversation', { path: '/c', interval: 0, apply: () => {} });
  await scheduler.refresh('conversation');
  fail = true;
  await scheduler.refresh('conversation').catch(() => {});
  assert.equal(statuses.at(-1).stale, true);
  scheduler.forget('conversation'); scheduler.forget('missing');
  await scheduler.refresh('conversation').catch(() => {});
  assert.equal(statuses.at(-1).stale, false);
  scheduler.stop();
});
