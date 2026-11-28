// The notice about a state file the backend set aside (issue #50): shown on every view, dismissible,
// remembered per profile, and shown again for a newer file. Run from the repo root against a served build
// (BROWSER_TEST_BASE_URL, default http://127.0.0.1:4174), like browser-redesign.mjs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { mockDashboard } from './redesign-fixture.mjs';

const output = 'backend/target/redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }) });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const first = 'assistant-state.json.corrupt-20261127T204512345Z';
const newer = 'assistant-state.json.corrupt-20261201T080000000Z';
const settings = files => ({ provider: 'openai', assistantConfigured: false, openAiConfigured: false, profileApiKey: false, anthropicConfigured: false, profileAnthropicKey: false,
  models: { openai: 'gpt-6.2-sol', anthropic: 'claude-sonnet-5-5' }, stateRecovery: { files } });
const errors = [];
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/Content Security Policy/.test(message.text())) errors.push(message.text()); });
    let files = [first];
    await mockDashboard(page, { handle: async (route, requestUrl) => {
      if (requestUrl.pathname === '/api/profile/settings') { await route.fulfill({ json: settings(files) }); return true; }
      return false;
    } });
    await page.goto(url);
    const notice = page.getByText('Some saved data could not be read', { exact: true });
    await notice.waitFor();
    assert.equal(await page.getByText(first, { exact: false }).count() > 0, true, 'The notice does not name the preserved file');
    await page.screenshot({ path: `${output}/state-recovery-${scheme}.png` });

    // Every view shows it, including the narrow layout.
    for (const view of ['System Info', 'Conversations', 'Memories', 'Settings']) {
      await page.getByRole('navigation').getByText(view, { exact: true }).first().click();
      await notice.waitFor();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await notice.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'The notice causes horizontal overflow');
    await page.screenshot({ path: `${output}/state-recovery-narrow-${scheme}.png` });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Dismissing hides it, and it stays hidden after a reload.
    await page.getByRole('button', { name: 'Dismiss data recovery notice' }).click();
    await notice.waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('navigation').getByText('Settings', { exact: true }).first().waitFor();
    assert.equal(await notice.count(), 0, 'A dismissed notice came back after a reload');

    // A newer set-aside file brings it back, naming the newer one.
    files = [newer, first];
    await page.reload();
    await notice.waitFor();
    assert.equal(await page.getByText(newer, { exact: false }).count() > 0, true);
    await page.close();
  }
  // Nothing set aside, nothing shown.
  const quiet = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await mockDashboard(quiet, { handle: async (route, requestUrl) => {
    if (requestUrl.pathname === '/api/profile/settings') { await route.fulfill({ json: settings([]) }); return true; }
    return false;
  } });
  await quiet.goto(url);
  await quiet.getByRole('navigation').getByText('Settings', { exact: true }).first().waitFor();
  assert.equal(await quiet.getByText('Some saved data could not be read', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('state recovery notice: ok');
} finally { await browser.close(); }
