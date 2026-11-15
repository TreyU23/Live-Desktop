import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDashboard } from './redesign-fixture.mjs';

// Two privacy commitments the Settings and System Info rewrites must keep:
// 1. Device and Product IDs stay hidden until the user asks for them (Show IDs).
// 2. The iCloud app-specific password is only ever sent to the local backend: it is never echoed
//    back into the page, kept in a field after connecting, or written to browser storage.
const kPassword = 'abcd-efgh-ijkl-mnop';
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }), headless: true });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  let connected = false;
  let sentPassword = null;
  await mockDashboard(page, { handle: async (route, requestUrl) => {
    if (requestUrl.pathname === '/api/integrations/icloud-calendar/connect') {
      sentPassword = JSON.parse(route.request().postData() || '{}').appSpecificPassword;
      connected = true;
      // The backend answers with calendar state only; it never returns the credential.
      await route.fulfill({ json: { connected: true, status: 'connected', email: 'you@icloud.com', detail: 'Synthetic calendar', capturedAt: new Date().toISOString(), date: null, events: [] } });
      return true;
    }
    if (requestUrl.pathname === '/api/integrations/icloud-calendar' && !connected) {
      await route.fulfill({ json: { connected: false, status: 'disconnected', detail: 'Not connected', events: [] } });
      return true;
    }
    return false;
  } });
  await page.goto(url);
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  const nav = name => page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();

  await nav('System Info');
  await page.getByRole('heading', { name: 'System Info', exact: true }).waitFor();
  const main = page.getByRole('main');
  assert.ok(!(await main.innerText()).includes('SYNTHETIC-DEVICE-ID'), 'Device ID visible before Show IDs');
  assert.ok(!(await main.innerText()).includes('SYNTHETIC-PRODUCT-ID'), 'Product ID visible before Show IDs');
  await page.getByRole('button', { name: 'Show IDs' }).click();
  assert.ok((await main.innerText()).includes('SYNTHETIC-DEVICE-ID'), 'Show IDs did not reveal the Device ID');
  await page.getByRole('button', { name: 'Hide IDs' }).click();
  assert.ok(!(await main.innerText()).includes('SYNTHETIC-DEVICE-ID'), 'Hide IDs left the Device ID visible');
  await page.getByRole('radio', { name: 'Specifications' }).click();
  assert.ok(!(await main.innerText()).includes('SYNTHETIC-DEVICE-ID'), 'Specifications tab exposes IDs without Show IDs');

  await nav('Settings');
  await page.getByRole('button', { name: 'Connect…' }).click();
  await page.getByRole('textbox', { name: 'Apple Account email' }).fill('you@icloud.com');
  const password = page.getByLabel('App-specific password');
  assert.equal(await password.getAttribute('type'), 'password', 'Password field is not masked');
  await password.fill(kPassword);
  await page.getByRole('button', { name: 'Connect iCloud Calendar' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).waitFor();
  assert.equal(sentPassword, kPassword, 'Password did not reach the local backend');
  const leaks = await page.evaluate(secret => ({
    text: document.body.innerText.includes(secret),
    inputs: [...document.querySelectorAll('input, textarea')].some(input => input.value.includes(secret)),
    storage: [...Array(localStorage.length).keys()].some(index => (localStorage.getItem(localStorage.key(index)) || '').includes(secret))
      || [...Array(sessionStorage.length).keys()].some(index => (sessionStorage.getItem(sessionStorage.key(index)) || '').includes(secret)),
  }), kPassword);
  assert.deepEqual(leaks, { text: false, inputs: false, storage: false }, 'iCloud password echoed after connecting');
  assert.deepEqual(errors, []);
  console.log('PASS: IDs stay behind Show IDs; the iCloud app-specific password is sent once and never echoed or stored in the page.');
} finally { await browser.close(); }
