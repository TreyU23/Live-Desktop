// "Refresh conversation" after a failed thread load (issue #36). Run from the repo root against a served
// build (BROWSER_TEST_BASE_URL, default http://127.0.0.1:4174), like browser-redesign.mjs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDashboard } from './redesign-fixture.mjs';

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }) });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const errors = [];

async function open(scenario) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  const threadReads = []; const badRequests = [];
  await mockDashboard(page, { handle: async (route, requestUrl) => {
    if (/\/api\/conversations\/(undefined|null)$/.test(requestUrl.pathname)) badRequests.push(`${route.request().method()} ${requestUrl.pathname}`);
    if (requestUrl.pathname === '/api/conversations/c1' && route.request().method() === 'GET') {
      threadReads.push(requestUrl.pathname);
      return scenario(route, threadReads.length);
    }
    return false;
  } });
  await page.goto(url);
  await page.getByRole('navigation').getByText('Conversations', { exact: true }).first().click();
  await page.getByText('Synthetic conversation', { exact: true }).first().click();
  return { page, threadReads, badRequests };
}

try {
  // A failed read can be retried: the retry reloads the same thread, not the thread list.
  {
    const { page, threadReads, badRequests } = await open(async (route, attempt) => {
      if (attempt === 1) { await route.fulfill({ status: 500, json: { error: 'The thread could not be read.' } }); return true; }
      return false;
    });
    const refresh = page.getByRole('button', { name: 'Refresh conversation' });
    await refresh.waitFor();
    await refresh.click();
    await page.getByText('What is running on this PC?', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete conversation' }).waitFor();
    assert.equal(threadReads.length, 2, 'The retry did not reload the open thread');
    assert.deepEqual(badRequests, []);
    await page.close();
  }
  // A thread deleted elsewhere closes instead of becoming an empty, deletable thread.
  {
    const { page, badRequests } = await open(async route => { await route.fulfill({ status: 404, json: { error: 'Conversation not found.' } }); return true; });
    await page.getByLabel('Notifications').getByText('That conversation no longer exists.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Refresh conversation' }).count(), 0, 'A refresh is still offered for a missing thread');
    assert.equal(await page.getByRole('button', { name: 'Delete conversation' }).count(), 0, 'A missing thread can still be deleted');
    assert.deepEqual(badRequests, []);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('conversation refresh: ok');
} finally { await browser.close(); }
