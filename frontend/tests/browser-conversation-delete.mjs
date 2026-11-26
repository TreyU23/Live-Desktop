// Deleting a conversation: button, confirmation, request, and what is left on screen. Run from the repo root
// against a served build (BROWSER_TEST_BASE_URL, default http://127.0.0.1:4174), like browser-redesign.mjs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { mockDashboard } from './redesign-fixture.mjs';

const output = 'backend/target/redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }) });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const errors = [];
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/Content Security Policy/.test(message.text())) errors.push(message.text()); });
    const deletes = []; let deleted = false; let busy = scheme === 'dark';
    await mockDashboard(page, { handle: async (route, requestUrl) => {
      if (requestUrl.pathname === '/api/conversations' && deleted) { await route.fulfill({ json: [] }); return true; }
      if (requestUrl.pathname === '/api/conversations/c1' && route.request().method() === 'DELETE') {
        deletes.push(route.request().method());
        if (busy) { busy = false; await route.fulfill({ status: 409, json: { error: 'This conversation is still answering a message. Wait for the reply, then delete it.', code: 'conversation_busy' } }); return true; }
        deleted = true; await route.fulfill({ status: 204, body: '' }); return true;
      }
      return false;
    } });
    await page.goto(url);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), scheme);
    await page.getByRole('navigation').getByText('Conversations', { exact: true }).first().click();
    assert.equal(await page.getByRole('button', { name: 'Delete conversation' }).count(), 0, 'Delete shows before a thread is open');
    await page.getByText('Synthetic conversation', { exact: true }).first().click();
    await page.getByText('What is running on this PC?', { exact: true }).waitFor();
    const button = page.getByRole('button', { name: 'Delete conversation' });
    await button.waitFor();
    await page.screenshot({ path: `${output}/conversation-delete-${scheme}.png` });
    // Cancelling sends nothing.
    await button.click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    await page.screenshot({ path: `${output}/conversation-delete-dialog-${scheme}.png` });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(deletes.length, 0);
    if (scheme === 'dark') {
      // A refused delete (conversation busy) keeps the thread open and says why.
      await button.click(); await dialog.getByRole('button', { name: 'Delete conversation' }).click();
      await page.getByLabel('Notifications').getByText(/still answering/).waitFor();
      assert.equal(await page.getByText('What is running on this PC?', { exact: true }).count(), 1, 'A refused delete closed the thread');
      await page.getByLabel('Notifications').getByRole('button', { name: /dismiss|close/i }).first().click();
    }
    await button.click(); await dialog.getByRole('button', { name: 'Delete conversation' }).click();
    await page.getByText('No saved conversations yet.', { exact: true }).waitFor();
    assert.equal(await page.getByText('What is running on this PC?', { exact: true }).count(), 0, 'Messages stayed on screen');
    assert.equal(await page.getByRole('button', { name: 'Delete conversation' }).count(), 0);
    assert.equal(deletes.length, scheme === 'dark' ? 2 : 1);
    await page.screenshot({ path: `${output}/conversation-deleted-${scheme}.png` });
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('conversation delete: ok');
} finally { await browser.close(); }
