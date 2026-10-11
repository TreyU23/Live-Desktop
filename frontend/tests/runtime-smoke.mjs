import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const output = fileURLToPath(new URL('../../backend/target/performance/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const systemResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/system');
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('heading', { name: 'Today on your PC' }).waitFor();
  const response = await systemResponse;
  assert.equal(response.status(), 200);
  const system = await response.json();
  assert.ok(system.resources && Array.isArray(system.controls));
  await page.waitForTimeout(250);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${output}/production-dashboard.png` });
  await writeFile(`${output}/runtime-browser.json`, JSON.stringify({ passed: true, browser: browser.version(), systemStatus: response.status(), deferredIframe: true, errors }, null, 2));
  console.log('PASS: built dashboard served through native host with real backend/system API and no page errors.');
} finally { await browser.close(); }
