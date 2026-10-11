import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const mutation = deferred();
const staleRead = deferred();
let mutationStarted = false;
let staleReadStarted = false;
let staleReadReleased = false;
let failMemoryWrite = true;
let memorySaved = false;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const system = { host: { name: 'Synthetic workstation', user: 'Test', os: 'Windows', architecture: 'x64' }, resources: { cpuPercent: 1, memoryUsedBytes: 100, memoryTotalBytes: 200, storageUsedBytes: 100, storageTotalBytes: 200, network: { connected: false }, battery: { available: false } }, controls: [{ id: 'wifi', label: 'Wi-Fi', available: true, enabled: false, direct: true }], device: { graphics: [] }, windows: {} };
await page.clock.install();
await page.route('**/*', async route => {
  const path = new URL(route.request().url()).pathname;
  if (!path.startsWith('/api/') && path !== '/health') return route.continue();
  let body = [];
  if (path === '/api/memories' && route.request().method() === 'POST') {
    if (failMemoryWrite) return route.fulfill({ status: 500, json: { error: 'Synthetic persistence failure' } });
    memorySaved = true;
    return route.fulfill({ json: { id: 'synthetic-memory', content: 'Keep this unsaved memory' } });
  }
  if (path === '/api/memories' && memorySaved) return route.fulfill({ status: 500, json: { error: 'Synthetic list refresh failure' } });
  if (path === '/health') body = { status: 'ok', openAiConfigured: false };
  if (path === '/api/system/controls/wifi') {
    mutationStarted = true;
    await mutation.promise;
    body = { id: 'synthetic-control', kind: 'windows_set_control', status: 'completed', reason: 'Synthetic radio', createdAt: '2026-10-10T12:00:00Z', arguments: { control: 'wifi', enabled: true }, result: { control: 'wifi', enabled: true, available: true } };
  }
  if (path === '/api/system') {
    if (mutationStarted && !staleReadReleased) { staleReadStarted = true; await staleRead.promise; }
    body = system;
  }
  if (path === '/api/runtime') body = { backendOnline: true, frontendOnline: true };
  if (path === '/api/profile/settings') body = { openAiConfigured: false, profileApiKey: false };
  if (path === '/api/integrations/phone-link') body = { installed: false, detail: 'Synthetic phone' };
  if (path === '/api/integrations/icloud-calendar') body = { configured: false, status: 'disconnected', date: '2026-10-10', events: [] };
  if (path === '/api/integrations/media-session') body = { available: false, title: 'Nothing playing', duration: 0, elapsed: 0 };
  try { await route.fulfill({ json: body }); } catch { /* Expected aborted pre-confirmation read. */ }
});
try {
  await page.goto('http://127.0.0.1:4174/');
  await page.clock.runFor(200);
  const radio = page.getByRole('switch', { name: 'Wi-Fi: off. Request on', exact: true });
  await radio.waitFor();
  await radio.click();
  await page.waitForTimeout(100);
  assert.ok(mutationStarted);
  // A visibility reconciliation starts an old-state read while the POST is pending.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(100);
  assert.ok(staleReadStarted, 'Did not create the concurrent stale system read');
  mutation.release();
  await page.clock.runFor(100);
  await page.getByRole('switch', { name: 'Wi-Fi: on. Request off', exact: true }).waitFor();
  staleReadReleased = true;
  staleRead.release();
  await page.waitForTimeout(200);
  await page.clock.runFor(100);
  assert.equal(await page.getByRole('switch', { name: 'Wi-Fi: on. Request off', exact: true }).count(), 1, 'Late pre-confirmation read replaced confirmed control state');
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  const memoryInput = page.getByRole('textbox', { name: 'Memory content' });
  await memoryInput.fill('Keep this unsaved memory');
  await page.getByRole('button', { name: 'Add memory', exact: true }).click();
  await page.getByText('Synthetic persistence failure', { exact: true }).waitFor();
  assert.equal(await memoryInput.inputValue(), 'Keep this unsaved memory', 'Failed memory save discarded user input');
  failMemoryWrite = false;
  await page.getByRole('button', { name: 'Add memory', exact: true }).click();
  await page.getByText('Memory saved, but the list could not refresh: Synthetic list refresh failure', { exact: true }).waitFor();
  assert.equal(await memoryInput.inputValue(), '', 'Successful memory save with failed list refresh left duplicate retry content');
  assert.deepEqual(errors, []);
  console.log('PASS: mutation-time stale poll cannot replace confirmed control; failed memory save preserves typed input');
} finally { mutation.release(); staleRead.release(); await browser.close(); }
