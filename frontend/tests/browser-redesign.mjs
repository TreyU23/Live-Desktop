import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { mockDashboard, system, actions as fixtureActions, sheetAction, sheetFileAction } from './redesign-fixture.mjs';
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
  let emptyCalendar = false;
  let extraActions = [];
  const decisions = [];
  let releaseSystem;
  const systemGate = new Promise(resolve => { releaseSystem = resolve; });
  await mockDashboard(page, { handle: async (route, requestUrl) => {
    if (requestUrl.pathname === '/api/chat') { await route.fulfill(failChat ? { status: 500, json: { error: 'Synthetic send failure' } } : { json: { conversationId: 'c1' } }); return true; }
    if (requestUrl.pathname === '/api/system') {
      if (holdSystem) await systemGate;
      await route.fulfill(failSystem ? { status: 503, json: { error: 'Synthetic system offline' } } : { json: { ...system, resources: { ...system.resources, cpuPercent: 0 } } }); return true;
    }
    if (requestUrl.pathname === '/api/integrations/icloud-calendar/open' || requestUrl.pathname === '/api/integrations/icloud-calendar/open-web' || requestUrl.pathname === '/api/integrations/media-session/open-external') {
      await route.fulfill({ status: 202, json: { id: 'synthetic-open', kind: 'windows_open_uri', status: 'pending', reason: 'Synthetic external open' } });
      return true;
    }
    if (requestUrl.pathname === '/api/actions') { await route.fulfill({ json: [...extraActions, ...fixtureActions] }); return true; }
    const decision = requestUrl.pathname.match(/^\/api\/actions\/([^/]+)\/(approve|reject)$/);
    if (decision) {
      decisions.push(`${decision[1]}:${decision[2]}`);
      const action = extraActions.find(item => item.id === decision[1]);
      extraActions = extraActions.filter(item => item.id !== decision[1]);
      await route.fulfill({ json: { ...action, status: decision[2] === 'approve' ? 'completed' : 'rejected', updatedAt: new Date().toISOString() } });
      return true;
    }
    if (emptyCalendar && requestUrl.pathname === '/api/integrations/icloud-calendar') {
      await route.fulfill({
        json: {
          connected: true,
          status: 'connected',
          date: requestUrl.searchParams.get('date'),
          detail: 'Synthetic empty calendar',
          capturedAt: new Date().toISOString(),
          events: [],
        },
      });
      return true;
    }
    return false;
  } });
  await page.goto(url);
  await page.locator('.gauge-value strong').first().getByText('0', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Voice input' }).count(), 0);
  const navigate = async name => {
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const accessibleName = new RegExp(`^${name}( \\d+ pending)?$`);
    const destination = nav.getByRole('button', { name: accessibleName });
    if (!await destination.isVisible()) await nav.getByRole('button', { name: /^More/ }).click();
    assert.equal(await nav.getByRole('button', { name: accessibleName }).count(), 1, `${name} destination is ambiguous`);
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
        const region = document.querySelector('.view-region'); const nav = document.querySelector('.sidebar').getBoundingClientRect(); const view = region.getBoundingClientRect();
        // Sidebar on the left at desktop widths, tab bar at the bottom below 768px; never overlapping the view.
        const overlaps = !(nav.right <= view.left + 1 || view.right <= nav.left + 1 || nav.bottom <= view.top + 1 || view.bottom <= nav.top + 1);
        return { documentOverflow: document.documentElement.scrollWidth > innerWidth, viewOverflow: region.scrollWidth > region.clientWidth + 1, navInside: nav.bottom <= innerHeight + 1 && nav.right <= innerWidth + 1, overlaps, tabBar: nav.width >= innerWidth - 1 };
      });
      assert.equal(geometry.documentOverflow, false, `${id} document overflow at ${width}`);
      assert.equal(geometry.viewOverflow, false, `${id} view overflow at ${width}`);
      assert.ok(geometry.navInside && !geometry.overlaps, `Navigation overlaps ${id} at ${width}`);
      assert.equal(geometry.tabBar, width < 768, `Navigation layout at ${width}`);
      await page.locator('.view-region').evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await page.getByRole('navigation').isVisible());
      matrix.push({ width, height, view: id, overflow: false, reservedNavigation: true, tabBar: width < 768 });
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
  // Approval sheet: pre-existing requests do not interrupt; a request that appears while the view is open does.
  assert.equal(await page.getByRole('dialog').count(), 0, 'Older pending requests opened the sheet');
  extraActions = [sheetFileAction, sheetAction];
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const sheet = page.getByRole('dialog', { name: 'Write a workspace file?' });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /1 of 5/);
  assert.match(await sheet.innerText(), /Allowing also allows matching requests later/);
  assert.equal(await sheet.getByRole('button', { name: 'Allow Once' }).count(), 0, 'Sheet must not promise a one-shot approval');
  assert.match(await sheet.locator('.action-content').innerText(), /<img src=x onerror=alert\(1\)>Literal/);
  assert.equal(await sheet.locator('.action-content img').count(), 0);
  assert.ok(await sheet.evaluate(element => element.contains(document.activeElement)), 'Sheet did not take focus');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
  assert.ok(await sheet.evaluate(element => element.contains(document.activeElement)), 'Focus escaped the sheet');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  assert.equal(await chat.evaluate(element => element === document.activeElement), true, 'Focus did not return to the composer');
  assert.equal(await chat.inputValue(), 'Keep this conversation draft', 'Sheet lost the draft');
  await page.getByRole('button', { name: /Review requests/ }).click();
  await sheet.waitFor();
  await sheet.getByRole('button', { name: 'Don’t Allow' }).click();
  await page.getByRole('dialog', { name: 'Change a device control?' }).waitFor();
  assert.deepEqual(decisions, ['sheet-file:reject']);
  await page.screenshot({ path: `${output}/approval-sheet-1440.png` });
  await page.getByRole('dialog').getByRole('button', { name: 'Allow', exact: true }).click();
  await page.getByRole('dialog').getByText('Turn off Wi-Fi', { exact: true }).waitFor();
  assert.deepEqual(decisions, ['sheet-file:reject', 'sheet-bt:approve']);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  const shutdown = page.getByRole('button', { name: 'Shut down frontend and backend' });
  await shutdown.click();
  assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button', { name: 'Shut down both' }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await shutdown.evaluate(element => element === document.activeElement), true);
  await page.getByRole('button', { name: /opens the profile picker/ }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: /opens the profile picker/ }).evaluate(element => element === document.activeElement), true);
  await navigate('Settings');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await page.getByRole('textbox', { name: 'Custom hex color' }).fill('#FFFF00');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.accent-color.default')), '#FFFF00');
  await page.screenshot({ path: `${output}/settings-light-yellow.png` });
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-foreground').trim()), '#000000');
  await navigate('Settings');
  await page.screenshot({ path: `${output}/settings-light-1440.png` });
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Use Blue accent' }).click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-fill-ink').trim()), '#FFFFFF');
  // Reduce transparency: explicit setting and the system media feature both give solid surfaces.
  await page.getByRole('switch', { name: 'Reduce transparency' }).click();
  assert.equal(await page.locator('html').getAttribute('data-transparency'), 'reduced');
  assert.equal(await page.locator('.sidebar').evaluate(element => getComputedStyle(element).backgroundImage), 'none');
  await page.getByRole('switch', { name: 'Reduce transparency' }).click();
  assert.notEqual(await page.locator('.sidebar').evaluate(element => getComputedStyle(element).backgroundImage), 'none');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  assert.equal(await page.locator('.sidebar').evaluate(element => getComputedStyle(element).backgroundImage), 'none');
  await navigate('Overview');
  await page.screenshot({ path: `${output}/overview-reduced-transparency-1440.png` });
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  // Sidebar search filters page names locally and navigates on Enter.
  await page.getByRole('searchbox', { name: 'Find a page' }).fill('mem');
  assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).locator('.sidebar__section .sidebar__item').count(), 1);
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Memories', exact: true }).waitFor();
  await navigate('Overview');
  await navigate('Overview');
  assert.ok(await page.locator('.resource-gauge.gauge--critical .gauge-fill--critical').count() > 0, 'high memory should use critical severity coloring');
  assert.ok(await page.getByRole('button', { name: /Open Apple Music externally/ }).isVisible(), 'music empty state should offer an external open action');
  assert.ok(await page.getByText('Network throughput').isVisible());
  assert.ok(await page.getByText('Disk activity').isVisible());
  await page.getByRole('button', { name: 'Open day view' }).click();
  await page.getByRole('heading', { name: 'All-day events' }).waitFor();
  await page.getByRole('button', { name: 'Phone details', exact: true }).click();
  await page.getByRole('button', { name: 'Open Phone Link externally' }).waitFor();
  await page.screenshot({ path: `${output}/expanded-panels.png` });
  emptyCalendar = true;
  await page.getByRole('button', { name: 'Refresh iCloud Calendar' }).click();
  await page.getByText('No iCloud events for this day.').waitFor();
  await page.getByRole('button', { name: 'Open Calendar externally' }).waitFor();
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
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
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
  console.log(`PASS: ${matrix.length} view/viewport combinations; scope, draft, dialog, approval sheet, appearance, reduced transparency, search, loading, retry and panel checks.`);
} finally { await browser.close(); }
