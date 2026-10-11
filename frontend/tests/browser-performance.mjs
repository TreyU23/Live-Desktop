import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv.includes('--baseline');
let baselineSource;
if (baseline) {
  const { transformSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
  const source = execFileSync('git', ['show', 'HEAD:frontend/src/App.jsx'], { encoding: 'utf8' })
    .replace('import { useCallback, useEffect, useMemo, useState } from "react";', 'import React from "react"; const { useCallback, useEffect, useMemo, useState } = React;');
  baselineSource = transformSync(source, { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', define: { 'import.meta.env.VITE_API_BASE': '""' } }).code
    .replaceAll('"react"', '"/node_modules/.vite/deps/react.js"')
    .replaceAll('"react-icons/fi"', '"/node_modules/.vite/deps/react-icons_fi.js"')
    .replaceAll('from "./', 'from "/src/');
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.clock.install();
const counts = new Map();
const profileHeaders = [];
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
const system = { host: { name: 'Synthetic workstation', user: 'Test', os: 'Windows', architecture: 'x64' }, resources: { cpuPercent: 1, memoryUsedBytes: 100, memoryTotalBytes: 200, storageUsedBytes: 100, storageTotalBytes: 200, network: { connected: false }, battery: { available: false } }, controls: [{ id: 'wifi', label: 'Wi-Fi', available: true, enabled: false, direct: true, detail: 'Synthetic radio' }], device: { graphics: [] }, windows: {} };
let releaseControl;
const controlGate = new Promise(resolve => { releaseControl = resolve; });
let releaseCalendar;
const calendarGate = new Promise(resolve => { releaseCalendar = resolve; });
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (baseline && url.pathname === '/src/App.jsx') return route.fulfill({ contentType: 'text/javascript', body: baselineSource });
  if (url.hostname === 'embed.music.apple.com') return route.fulfill({ contentType: 'text/html', body: '<p>Mock music player</p>' });
  if (!url.pathname.startsWith('/api/') && url.pathname !== '/health') return route.continue();
  profileHeaders.push(route.request().headers()["x-profile-id"]);
  counts.set(url.pathname, (counts.get(url.pathname) || 0) + 1);
  let body = [];
  if (url.pathname === '/api/system/controls/wifi') { await controlGate; body = {id:'synthetic',status:'pending',summary:'Synthetic Wi-Fi approval',arguments:{control:'wifi',enabled:true}}; }
  if (url.pathname === '/health') body = { status: 'ok', openAiConfigured: false };
  if (url.pathname === '/api/system') body = system;
  if (url.pathname === '/api/runtime') body = { backendOnline: true, frontendOnline: true };
  if (url.pathname === '/api/profile/settings') body = { openAiConfigured: false, profileApiKey: false };
  if (url.pathname === '/api/integrations/phone-link') body = { installed: false, detail: 'Synthetic phone ready' };
  if (url.pathname === '/api/integrations/icloud-calendar') {
    await calendarGate;
    body = { configured: false, status: 'disconnected', date: '2026-10-10', events: [], detail: 'Connect Calendar in Settings' };
  }
  if (url.pathname === '/api/integrations/media-session') body = { available: false, title: 'Nothing playing', artwork: '/assets/album-cover.png', duration: 0, elapsed: 0 };
  try { await route.fulfill({ json: body }); } catch { /* Aborted reads during reload/teardown. */ }
});
try {
  const started = Date.now();
  await page.goto('http://127.0.0.1:4174/?diagnostics=1');
  await page.clock.runFor(200);
  await page.waitForTimeout(1000);
  const independentlyReady = await page.getByText('Local mode', { exact: true }).count() > 0;
  if (!baseline) assert.ok(independentlyReady, 'Core UI waited for calendar');
  const coreCommitMs = baseline ? null : await page.evaluate(() => window.liveDesktopTimings().filter(sample => ['health','system','actions','memories','settings'].includes(sample.resource) && sample.phase === 'widget-commit').map(sample => sample.duration));
  if (!baseline) { assert.ok(coreCommitMs.length > 0); assert.ok(Math.max(...coreCommitMs) <= 250, 'Core commit exceeded 250ms'); }
  // Hold the optional request for a real ten seconds, not a synthetic response-only test.
  await page.waitForTimeout(Math.max(0, 10000 - (Date.now() - started)));
  releaseCalendar();
  await page.clock.runFor(500);
  await page.getByText('Local mode', { exact: true }).waitFor({ state: 'attached' });
  if (!baseline) {
    const radio = page.getByRole('switch', { name: 'Wi-Fi: off. Request on', exact: true });
    await radio.click();
    await page.clock.runFor(50);
    assert.equal(await radio.isDisabled(), true, 'Control click has no immediate pending feedback');
    releaseControl(); await page.clock.runFor(200); await page.waitForTimeout(100);
  }
  counts.clear();
  for (let elapsed = 0; elapsed < 300000; elapsed += 5000) {
    await page.clock.runFor(5000);
    await page.waitForTimeout(30);
  }
  const visibleRequests = [...counts.values()].reduce((a,b) => a+b, 0);
  assert.ok(visibleRequests > 0, 'Polling observation did not exercise timers');
  if (!baseline) assert.ok(visibleRequests <= 160, `Five-minute request budget exceeded: ${visibleRequests}`);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(20);
  counts.clear();
  for (let elapsed = 0; elapsed < 300000; elapsed += 5000) {
    await page.clock.runFor(5000);
    await page.waitForTimeout(30);
  }
  const hiddenRequests = [...counts.values()].reduce((a,b) => a+b, 0);
  if (!baseline) assert.equal(hiddenRequests, 0, 'Hidden dashboard continued polling');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(200);
  await page.screenshot({ path: '../backend/target/performance/dashboard-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../backend/target/performance/dashboard-mobile.png' });
  assert.deepEqual(errors, []);
  let iframeContinuity = null;
  if (!baseline) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator('iframe').count(), 0, 'Music loaded before first visit');
    await page.getByRole('button', { name: 'Music', exact: true }).click();
    await page.clock.runFor(200);
    await page.locator('iframe').waitFor();
    await page.locator('iframe').evaluate(element => { element.dataset.continuity = 'retained'; });
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    assert.equal(await page.locator('iframe').getAttribute('data-continuity'), 'retained');
    await page.getByRole('button', { name: 'Music', exact: true }).click();
    assert.equal(await page.locator('iframe').getAttribute('data-continuity'), 'retained');
    iframeContinuity = true;
    await page.evaluate(() => localStorage.setItem('live-desktop.profiles', JSON.stringify([
      {id:'default',name:'Local user',avatar:'/assets/user-avatar.png'},
      {id:'second',name:'Second profile',avatar:'/assets/user-avatar.png'}
    ])));
    await page.reload(); await page.clock.runFor(500);
    await page.getByRole('button', { name: 'Open profile picker for Local user' }).click();
    const headerIndex = profileHeaders.length;
    await page.getByRole('button', { name: 'Second profile Switch profile' }).click();
    await page.getByRole('button', { name: 'Open profile picker for Second profile' }).waitFor();
    await page.clock.runFor(500); await page.waitForTimeout(100);
    assert.ok(profileHeaders.length > headerIndex, 'Switched profile made no reads');
    assert.ok(profileHeaders.slice(headerIndex).every(id => id === 'second'), 'Old profile used after switch');
  }
  const result = { coreCommitMs, iframeContinuity, profileSwitch: !baseline, controlPendingWithinMs: baseline ? null : 50, baseline, independentlyReady, calendarDelayMs: 10000, visibleRequests, hiddenRequests, observationMs: 300000, clock: 'accelerated browser timers for polling; real delayed calendar', browser: browser.version(), errors };
  await mkdir('../backend/target/performance', { recursive: true });
  await writeFile(`../backend/target/performance/${baseline ? 'baseline' : 'candidate'}-browser.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { releaseCalendar(); releaseControl(); await browser.close(); }
