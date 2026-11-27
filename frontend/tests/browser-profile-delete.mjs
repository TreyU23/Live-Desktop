// Deleting a profile when the browser cannot save the profile list (issue #45). Run from the repo root
// against a served build (BROWSER_TEST_BASE_URL, default http://127.0.0.1:4174), like browser-redesign.mjs.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDashboard } from './redesign-fixture.mjs';

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }) });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const errors = [];
const profiles = [{ id: 'default', name: 'Local user', avatar: '/assets/user-avatar.png' }, { id: 'work', name: 'Work', avatar: '/assets/user-avatar.png' }];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(seed => {
    // Seed once; a reload after a successful delete must keep what the app saved.
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('live-desktop.profiles', JSON.stringify(seed));
      localStorage.setItem('live-desktop.active-profile', 'work');
    }
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'live-desktop.profiles' && sessionStorage.getItem('storage-full') === '1') throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  }, profiles);
  const deletes = [];
  await mockDashboard(page, { handle: async (route, requestUrl) => {
    if (requestUrl.pathname === '/api/profile/data' && route.request().method() === 'DELETE') {
      deletes.push(route.request().headers()['x-profile-id']);
      await route.fulfill({ status: 204, body: '' });
      return true;
    }
    return false;
  } });
  await page.goto(url);
  await page.evaluate(() => { sessionStorage.setItem('storage-full', '1'); window.__sameDocument = true; });

  async function deleteWork() {
    await page.getByRole('button', { name: 'Work, switch profile' }).click();
    await page.getByRole('menuitem', { name: /Manage profiles/ }).click();
    await page.getByRole('button', { name: 'Delete profile' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete profile data' }).click();
  }

  // The list cannot be saved: say so, stay put, and keep the profile in the list.
  await deleteWork();
  await page.getByLabel('Notifications').getByText(/data was deleted, but the profile list could not be updated/).waitFor();
  assert.equal(await page.evaluate(() => window.__sameDocument === true), true, 'The page reloaded although the list was not saved');
  assert.deepEqual(deletes, ['work']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('live-desktop.profiles')).length), 2);

  // Deleting again once storage works is safe, saves the list and leaves for the original profile.
  await page.evaluate(() => sessionStorage.removeItem('storage-full'));
  await page.getByRole('button', { name: 'Dismiss' }).first().click().catch(() => {});
  await Promise.all([page.waitForEvent('load'), deleteWork()]);
  assert.deepEqual(deletes, ['work', 'work']);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('live-desktop.profiles')).map(profile => profile.id)), ['default']);
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.active-profile')), 'default');
  assert.deepEqual(errors, []);
  console.log('profile delete: ok');
} finally { await browser.close(); }
