import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptResourceStatus, resourceViewState } from '../src/presentation/resourceViewState.js';
import { formatBytes, percent, formatPercent, localIsoDate } from '../src/presentation/formatters.js';
import { actionDetails } from '../src/presentation/actionDetails.js';
test('readiness distinguishes first failure, successful empty data and last-known failure', () => {
  assert.equal(resourceViewState(), 'loading');
  assert.equal(resourceViewState(adaptResourceStatus({}, { error: 'Offline' })), 'error');
  const ready = adaptResourceStatus({}, { loading: false, readyAt: 2, error: null }, 100000);
  assert.equal(resourceViewState(ready), 'ready');
  assert.equal(ready.lastSuccessAt, 100000);
  const stale = adaptResourceStatus(ready, { loading: false, error: 'Offline' }, 200000);
  assert.equal(resourceViewState(stale), 'stale');
  assert.equal(stale.lastSuccessAt, 100000);
});
test('zero and unavailable resource readings remain distinct', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(null), 'Unavailable');
  assert.equal(percent(0, 1024), 0);
  assert.equal(percent(null, 1024), null);
  assert.equal(percent(4, 0), null);
  assert.equal(percent(200, 100), 200);
  assert.equal(formatPercent(null), 'Unavailable');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(200), 'Unavailable');
});
test('calendar key preserves the intended local day at DST boundaries', () => {
  for (const day of [1, 2, 8]) assert.equal(localIsoDate(new Date(2026, 10, day, 12)), `2026-11-${String(day).padStart(2, '0')}`);
});
test('approval descriptions cover control-wide reuse and preserve literal untrusted content', () => {
  const details = actionDetails({ kind: 'windows_set_control', arguments: { control: 'wifi', enabled: false } });
  assert.match(details.scope, /both on and off/);
  const content = '<script>untrusted text</script>';
  assert.equal(actionDetails({ kind: 'workspace_write_file', arguments: { path: 'notes/a.txt', content } }).content, content);
  assert.match(actionDetails({ kind: 'remember', arguments: { category: 'fact' } }).scope, /category/);
  assert.ok(actionDetails({ kind: 'unknown' }).unsupported);
});
