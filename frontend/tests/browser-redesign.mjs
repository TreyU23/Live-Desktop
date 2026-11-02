import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { mockDashboard, system } from './redesign-fixture.mjs';
const output = 'backend/target/redesign';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }), headless: true });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const errors = [];
const matrix = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  let failChat = true;
  let failSystem = false;
  let holdSystem = false;
  let releaseSystem;
  const systemGate = new Promise(resolve => { releaseSystem = resolve; });
  await mockDashboard(page, { handle: async (route, requestUrl) => {
    if (requestUrl.pathname === '/api/chat') { await route.fulfill(failChat ? { status: 500, json: { error: 'Synthetic send failure' } } : { json: { conversationId: 'c1' } }); return true; }
    if (requestUrl.pathname === '/api/system') {
      if (holdSystem) await systemGate;
      await route.fulfill(failSystem ? { status: 503, json: { error: 'Synthetic system offline' } } : { json: { ...system, resources: { ...system.resources, cpuPercent: 0 } } }); return true;
    }
    return false;
  } });
  await page.goto(url);
  await page.locator('.gauge-value strong').first().getByText('0', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Voice input' }).count(), 0);
  const navigate = async name => {
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const destination = nav.getByRole('button', { name, exact: true });
    if (!await destination.isVisible()) await nav.getByRole('button', { name: /^More/ }).click();
    await destination.click();
    await page.waitForTimeout(60);
  };
  for (const [width, height] of [[1920,1080], [1440,900], [1280,720], [768,1024], [390,844], [320,740]]) {
    await page.setViewportSize({ width, height });
    for (const [name, id] of [['Overview','home'], ['System Info','system'], ['Music','music'], ['Approvals','approvals'], ['Memories','memories'], ['Conversations','conversations'], ['Settings','settings']]) {
      console.log(`Checking ${id} at ${width}x${height}`);
      await navigate(name);
      assert.ok(await page.locator('main h1').count(), `${id} has no heading`);
      const geometry = await page.evaluate(() => {
        const region = document.querySelector('.view-region'); const dock = document.querySelector('.navigation-dock').getBoundingClientRect();
        return { documentOverflow: document.documentElement.scrollWidth > innerWidth, viewOverflow: region.scrollWidth > region.clientWidth + 1, dockBottom: dock.bottom, screenHeight: innerHeight, regionBottom: region.getBoundingClientRect().bottom, dockTop: dock.top };
      });
      assert.equal(geometry.documentOverflow, false, `${id} document overflow at ${width}`);
      assert.equal(geometry.viewOverflow, false, `${id} view overflow at ${width}`);
      assert.ok(geometry.dockBottom <= height + 1 && geometry.regionBottom <= geometry.dockTop + 1, `Dock overlaps ${id}`);
      await page.locator('.view-region').evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await page.getByRole('navigation').isVisible());
      matrix.push({ width, height, view: id, overflow: false, reservedDock: true });
      if ([1440,390,320].includes(width)) {
        await page.locator('.view-region').evaluate(element => { element.scrollTop = 0; });
        await page.locator('h1').evaluate(element => element.blur());
        await page.screenshot({ path: `${output}/${id}-${width}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigate('Approvals');
  assert.match(await page.getByRole('article', { name: 'Selected action details' }).innerText(), /both on and off/);
  await page.getByRole('button', { name: /Save a local note/ }).click();
  assert.match(await page.locator('.action-content').innerText(), /<script>Text only<\/script>/);
  assert.equal(await page.locator('.action-content script').count(), 0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /Unsupported action/ }).click();
  assert.match(await page.getByRole('article', { name: 'Selected action details' }).innerText(), /cannot describe/);
  await navigate('Overview');
  const draft = page.getByRole('textbox', { name: 'Ask your assistant' });
  await draft.fill('Keep this Home draft'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Synthetic send failure', { exact: true }).waitFor();
  assert.equal(await draft.inputValue(), 'Keep this Home draft');
  failChat = false;
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('heading', { name: 'Conversations', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Synthetic conversation', exact: true }).waitFor();
  failChat = true;
  const chat = page.getByRole('textbox', { name: 'Message your assistant' });
  await chat.fill('Keep this conversation draft'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Message could not be sent. Your draft is preserved; try again.').waitFor();
  assert.equal(await chat.inputValue(), 'Keep this conversation draft');
  const shutdown = page.getByRole('button', { name: 'Shut down frontend and backend' });
  await shutdown.click();
  assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button', { name: 'Shut down both' }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await shutdown.evaluate(element => element === document.activeElement), true);
  await page.getByRole('button', { name: /Open profile picker/ }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: /Open profile picker/ }).evaluate(element => element === document.activeElement), true);
  await navigate('Settings');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await page.getByRole('textbox', { name: 'Custom hex color' }).fill('#FFFF00');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.accent-color.default')), '#FFFF00');
  await page.screenshot({ path: `${output}/settings-light-yellow.png` });
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-foreground').trim()), '#000000');
  await navigate('Settings');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await page.getByRole('button', { name: 'Use Blue accent' }).click();
  await navigate('Overview');
  await page.getByRole('button', { name: 'Open day view' }).click();
  await page.getByRole('heading', { name: 'All-day events' }).waitFor();
  await page.getByRole('button', { name: 'Phone details', exact: true }).click();
  await page.getByRole('button', { name: 'Open Phone Link externally' }).waitFor();
  await page.screenshot({ path: `${output}/expanded-panels.png` });
  // Stale values survive a failed resource read. Retry touches only system.
  failSystem = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByRole('button', { name: 'Retry system', exact: true }).waitFor();
  assert.equal(await page.locator('.gauge-value strong').first().innerText(), '0%');
  failSystem = false;
  await page.getByRole('button', { name: 'Retry system', exact: true }).click();
  await page.getByRole('button', { name: 'Retry system', exact: true }).waitFor({ state: 'detached' });
  holdSystem = true;
  await page.reload();
  await page.getByRole('heading', { name: 'System overview' }).waitFor();
  assert.equal(await page.locator('.gauge-value strong').first().innerText(), '—');
  releaseSystem();
  await page.getByRole('switch', { name: 'Wi-Fi: on. Request off', exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 360 });
  await navigate('Settings');
  await page.locator('.view-region').evaluate(element => { element.scrollTop = element.scrollHeight; });
  assert.ok(await page.getByRole('button', { name: 'Open full player', exact: true }).isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/browser-redesign.json`, JSON.stringify({ passed: true, browser: browser.version(), matrix, errors, synthetic: true, simulatedZoom: '640x360 CSS viewport approximates 200% of 1280x720; not browser UI zoom' }, null, 2));
  console.log(`PASS: ${matrix.length} view/viewport combinations; scope, draft, dialog, appearance, loading, retry and panel checks.`);
} finally { await browser.close(); }
