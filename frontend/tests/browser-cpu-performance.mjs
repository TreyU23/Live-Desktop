import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { transformSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
const source = execFileSync('git', ['show', 'HEAD:frontend/src/App.jsx'], { encoding: 'utf8' })
  .replace('import { useCallback, useEffect, useMemo, useState } from "react";', 'import React from "react"; const { useCallback, useEffect, useMemo, useState } = React;');
const baselineSource = transformSync(source, { loader: 'jsx', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', define: { 'import.meta.env.VITE_API_BASE': '""' } }).code
  .replaceAll('"react"', '"/node_modules/.vite/deps/react.js"')
  .replaceAll('"react-icons/fi"', '"/node_modules/.vite/deps/react-icons_fi.js"')
  .replaceAll('from "./', 'from "/src/');
const durationMs = Number(process.env.CPU_OBSERVATION_MS || 300000);
if (!Number.isFinite(durationMs) || durationMs < 1000) throw new Error('Invalid observation duration');
const browsers = [];
const candidateHashes = Object.fromEntries(await Promise.all(['src/App.jsx', 'src/resourceScheduler.js'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const result = { scope: 'Independent headless Edge browser-process trees with synthetic API responses. Same shared Windows workload; excludes Java/native backend CPU and process memory. Hidden visibility is emulated; browser throttling is not.', samplingLimit: 'CPU between the last sample and a process exit may be missed. New process CPU starts at zero. Inspect raw process IDs for churn.', workload: process.env.CPU_WORKLOAD_NOTE || 'Shared development machine; competing workloads are not controlled.', platform: `${os.platform()} ${os.release()} ${os.arch()}`, processors: os.cpus().length, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidate: 'working tree', candidateHashes, durationMs, startedAt: new Date().toISOString(), runs: [] };
await mkdir('../backend/target/performance', { recursive: true });
const save = () => writeFile('../backend/target/performance/browser-cpu.json', JSON.stringify(result, null, 2));
try {
  for (const baseline of [true, false]) {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const cdp = await browser.newBrowserCDPSession();
    const run = { baseline, browser: browser.version(), errors: [], phases: [] };
    result.runs.push(run);
    let requests = 0;
    page.on('pageerror', error => run.errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (baseline && url.pathname === '/src/App.jsx') return route.fulfill({ contentType: 'text/javascript', body: baselineSource });
      if (['embed.music.apple.com', 'open.spotify.com'].includes(url.hostname)) return route.fulfill({ contentType: 'text/html', body: '<p>Mock player</p>' });
      if (!url.pathname.startsWith('/api/') && url.pathname !== '/health') return route.continue();
      requests++;
      let body = [];
      if (url.pathname === '/health') body = { status: 'ok', openAiConfigured: false };
      if (url.pathname === '/api/system') body = { host: { name: 'Synthetic workstation', user: 'Test', os: 'Windows', architecture: 'x64' }, resources: { cpuPercent: 1, memoryUsedBytes: 100, memoryTotalBytes: 200, storageUsedBytes: 100, storageTotalBytes: 200, network: { connected: false }, battery: { available: false } }, controls: [], device: { graphics: [] }, windows: {} };
      if (url.pathname === '/api/runtime') body = { backendOnline: true, frontendOnline: true };
      if (url.pathname === '/api/profile/settings') body = { openAiConfigured: false, profileApiKey: false };
      if (url.pathname === '/api/integrations/phone-link') body = { installed: false, detail: 'Synthetic phone ready' };
      if (url.pathname === '/api/integrations/icloud-calendar') body = { configured: false, status: 'disconnected', date: '2026-10-10', events: [], detail: 'Connect Calendar in Settings' };
      if (url.pathname === '/api/integrations/media-session') body = { available: false, title: 'Nothing playing', artwork: '/assets/album-cover.png', duration: 0, elapsed: 0 };
      try { await route.fulfill({ json: body }); } catch { /* Teardown/aborted requests. */ }
    });
    await page.goto('http://127.0.0.1:4174/');
    await page.getByText('Local mode', { exact: true }).waitFor({ state: 'attached' });
    run.page = page; run.cdp = cdp; run.count = () => requests;
  }
  // Settle startup before measuring steady polling. Both instances remain alive throughout.
  await new Promise(resolve => setTimeout(resolve, 5000));
  for (const hidden of [false, true]) {
    const phases = [];
    for (const run of result.runs) {
      await run.page.evaluate(value => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
      const initial = await run.cdp.send('SystemInfo.getProcessInfo');
      const phase = { hidden, startedAt: new Date().toISOString(), samples: [{ elapsedMs: 0, processes: initial.processInfo }], requestStart: run.count() };
      run.phases.push(phase); phases.push(phase);
    }
    const started = performance.now();
    while (performance.now() - started < durationMs) {
      await new Promise(resolve => setTimeout(resolve, Math.min(30000, durationMs - (performance.now() - started))));
      for (let i = 0; i < result.runs.length; i++) {
        const info = await result.runs[i].cdp.send('SystemInfo.getProcessInfo');
        phases[i].samples.push({ elapsedMs: performance.now() - started, processes: info.processInfo });
      }
      console.log(`${hidden ? 'hidden' : 'visible'} ${Math.round((performance.now() - started) / 1000)}s`);
      // Strip live handles while preserving complete raw process CPU samples.
      await writeFile('../backend/target/performance/browser-cpu.json', JSON.stringify(result, (key, value) => ['page', 'cdp', 'count'].includes(key) ? undefined : value, 2));
    }
    for (let i = 0; i < result.runs.length; i++) {
      const phase = phases[i];
      phase.elapsedMs = phase.samples.at(-1).elapsedMs;
      phase.requests = result.runs[i].count() - phase.requestStart;
      const previous = new Map(phase.samples[0].processes.map(item => [item.id, item.cpuTime]));
      let cpuSeconds = 0;
      for (const sample of phase.samples.slice(1)) for (const item of sample.processes) {
        cpuSeconds += Math.max(0, item.cpuTime - (previous.get(item.id) ?? 0));
        previous.set(item.id, item.cpuTime);
      }
      phase.cpuSeconds = cpuSeconds;
      phase.averageCpuPercentOneCore = cpuSeconds / (phase.elapsedMs / 1000) * 100;
      phase.averageCpuPercentMachine = phase.averageCpuPercentOneCore / result.processors;
    }
  }
  for (const run of result.runs) { delete run.page; delete run.cdp; delete run.count; }
  result.completedAt = new Date().toISOString();
  await save();
  console.log(JSON.stringify(result.runs.map(run => ({ baseline: run.baseline, errors: run.errors, phases: run.phases.map(({ hidden, elapsedMs, requests, cpuSeconds, averageCpuPercentMachine }) => ({ hidden, elapsedMs, requests, cpuSeconds, averageCpuPercentMachine })) }))));
} finally { await Promise.all(browsers.map(browser => browser.close())); }
