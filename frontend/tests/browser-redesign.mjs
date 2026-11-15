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
  // The built app ships a Content Security Policy; any violation is a failure.
  page.on('console', message => { if (/Content Security Policy/.test(message.text())) errors.push(message.text()); });
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
  const cpuMeter = page.getByRole('meter', { name: 'CPU load' });
  await page.waitForFunction(() => document.querySelector('[role="meter"][aria-label="CPU load"]')?.getAttribute('aria-valuenow') === '0');
  assert.equal(await page.getByRole('button', { name: 'Voice input' }).count(), 0);
  const scrollView = where => page.getByRole('main').evaluate((element, to) => {
    while (element && element !== document.body && !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) element = element.parentElement;
    element.scrollTop = to === 'top' ? 0 : element.scrollHeight;
  }, where);
  const navigate = async name => {
    // Side navigation at 768px and wider; below that the same items sit in the AppShell drawer.
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    const accessibleName = new RegExp(`^${name}( \\d+ pending)?$`);
    let scope = nav;
    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await page.waitForTimeout(150); // AppShell settles its breakpoint after a resize.
    await nav.or(toggle).first().waitFor();
    if (!await nav.isVisible()) {
      await toggle.click();
      scope = page.getByRole('dialog', { name: 'Navigation' });
    }
    const destination = scope.getByRole('button', { name: accessibleName });
    await destination.first().waitFor();
    assert.equal(await destination.count(), 1, `${name} destination is ambiguous`);
    await destination.click();
    await page.getByRole('dialog', { name: 'Navigation' }).waitFor({ state: 'hidden' });
    if (scope === nav) assert.equal(await nav.getByRole('button', { name: accessibleName }).getAttribute('aria-current'), 'page');
    await page.waitForTimeout(60);
  };
  for (const [width, height] of [[1920,1080], [1440,900], [1280,720], [768,1024], [390,844], [320,740]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150); // AppShell re-measures its breakpoint after a resize.
    for (const [name, id] of [['Overview','home'], ['System Info','system'], ['Music','music'], ['Approvals','approvals'], ['Memories','memories'], ['Conversations','conversations'], ['Settings','settings']]) {
      console.log(`Checking ${id} at ${width}x${height}`);
      await navigate(name);
      assert.equal(await page.getByRole('main').locator('h1').count(), 1, `${id} needs exactly one heading`);
      const geometry = await page.evaluate(() => {
        // Landmarks, not class names: the primary navigation and the scroll container of the main landmark.
        const scroller = element => { while (element && element !== document.body && !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) element = element.parentElement; return element; };
        const region = scroller(document.querySelector('[role="main"], main')); const navElement = document.querySelector('nav[aria-label="Primary navigation"]'); const view = region.getBoundingClientRect();
        // Side navigation on the left at 768px and wider; below that it moves into a drawer behind a toggle.
        const drawer = !navElement || navElement.getBoundingClientRect().width === 0 || getComputedStyle(navElement).display === 'none';
        const nav = drawer ? { left: 0, right: 0, top: 0, bottom: 0 } : navElement.getBoundingClientRect();
        const overlaps = !drawer && !(nav.right <= view.left + 1 || view.right <= nav.left + 1 || nav.bottom <= view.top + 1 || view.bottom <= nav.top + 1);
        return { documentOverflow: document.documentElement.scrollWidth > innerWidth, viewOverflow: region.scrollWidth > region.clientWidth + 1, navInside: nav.bottom <= innerHeight + 1 && nav.right <= innerWidth + 1, overlaps, tabBar: drawer };
      });
      assert.equal(geometry.documentOverflow, false, `${id} document overflow at ${width}`);
      assert.equal(geometry.viewOverflow, false, `${id} view overflow at ${width}`);
      assert.ok(geometry.navInside && !geometry.overlaps, `Navigation overlaps ${id} at ${width}`);
      assert.equal(geometry.tabBar, width < 768, `Navigation layout at ${width}`);
      if (width < 768) assert.ok(await page.getByRole('button', { name: 'Open navigation' }).isVisible(), `Navigation toggle hidden at ${width}`);
      await scrollView('bottom');
      assert.ok(width < 768 ? await page.getByRole('button', { name: 'Open navigation' }).isVisible() : await page.getByRole('navigation', { name: 'Primary navigation' }).isVisible());
      matrix.push({ width, height, view: id, overflow: false, reservedNavigation: true, tabBar: width < 768 });
      if ([1440,390,320].includes(width)) {
        await scrollView('top');
        await page.getByRole('main').locator('h1').evaluate(element => element.blur());
        await page.screenshot({ path: `${output}/${id}-${width}.png` });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigate('Approvals');
  // Pending rows decide inline; the expanded row holds operation, target, reusable scope and content.
  await page.getByRole('button', { name: 'Expand Turn off Wi-Fi' }).click();
  assert.match(await page.getByLabel('Details for Turn off Wi-Fi').innerText(), /both on and off/);
  await page.getByRole('button', { name: 'Expand Save a local note' }).click();
  const noteContent = page.getByLabel('Details for Save a local note').getByLabel('Action content', { exact: true });
  assert.match(await noteContent.innerText(), /<script>Text only<\/script>/);
  assert.equal(await noteContent.locator('script').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Allow Once' }).count(), 0, 'No one-shot approval is offered');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Unsupported action' }).click();
  assert.match(await page.getByLabel('Details for Unsupported action').innerText(), /cannot describe/);
  await navigate('Overview');
  const draft = page.getByRole('textbox', { name: 'Ask your assistant' });
  await draft.fill('Keep this Home draft'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByLabel('Notifications').getByText('Synthetic send failure', { exact: true }).waitFor();
  // Error toasts persist until dismissed (Astryx default) so a failure is not missed.
  await page.getByLabel('Notifications').getByRole('button', { name: /dismiss|close/i }).first().click();
  assert.equal(await draft.inputValue(), 'Keep this Home draft');
  failChat = false;
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('heading', { name: 'Conversations', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Synthetic conversation', exact: true }).waitFor();
  failChat = true;
  const chat = page.getByRole('textbox', { name: 'Message input' });
  await chat.fill('Keep this conversation draft'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Message could not be sent. Your draft is preserved; try again.', { exact: true }).waitFor();
  assert.equal((await chat.innerText()).trim(), 'Keep this conversation draft');
  // Approval sheet: pre-existing requests do not interrupt; a request that appears while the view is open does.
  assert.equal(await page.getByRole('dialog').count(), 0, 'Older pending requests opened the sheet');
  extraActions = [sheetFileAction, sheetAction];
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const sheet = page.getByRole('dialog', { name: 'Allow Live Desktop to save a sheet note?' });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /1 of 5/);
  assert.match(await sheet.innerText(), /Allowing also allows matching requests later/);
  assert.equal(await sheet.getByRole('button', { name: 'Allow Once' }).count(), 0, 'Sheet must not promise a one-shot approval');
  assert.match(await sheet.getByLabel('Action content', { exact: true }).innerText(), /<img src=x onerror=alert\(1\)>Literal/);
  assert.equal(await sheet.getByLabel('Action content', { exact: true }).locator('img').count(), 0);
  assert.ok(await sheet.evaluate(element => element.contains(document.activeElement)), 'Sheet did not take focus');
  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
  assert.ok(await sheet.evaluate(element => element.contains(document.activeElement)), 'Focus escaped the sheet');
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  assert.equal(await chat.evaluate(element => element === document.activeElement), true, 'Focus did not return to the composer');
  assert.equal((await chat.innerText()).trim(), 'Keep this conversation draft', 'Sheet lost the draft');
  await page.getByRole('button', { name: /Review requests/ }).click();
  await sheet.waitFor();
  await sheet.getByRole('button', { name: 'Don’t Allow' }).click();
  await page.getByRole('dialog', { name: 'Allow Live Desktop to turn off Bluetooth for focus time?' }).waitFor();
  assert.deepEqual(decisions, ['sheet-file:reject']);
  await page.screenshot({ path: `${output}/approval-sheet-1440.png` });
  await page.getByRole('dialog').getByRole('button', { name: 'Allow', exact: true }).click();
  await page.getByRole('dialog', { name: 'Allow Live Desktop to turn off Wi-Fi?' }).waitFor();
  assert.deepEqual(decisions, ['sheet-file:reject', 'sheet-bt:approve']);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  // Stop is confirmed first and names Live Desktop's services, not Windows.
  const shutdown = page.getByRole('button', { name: 'Stop Live Desktop', exact: true });
  await shutdown.click();
  const stopDialog = page.getByRole('alertdialog', { name: 'Stop Live Desktop?' });
  await stopDialog.waitFor();
  assert.match(await stopDialog.innerText(), /does not shut down Windows/);
  assert.ok(await stopDialog.evaluate(element => element.contains(document.activeElement)), 'Stop confirmation did not take focus');
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('Tab');
  assert.ok(await stopDialog.evaluate(element => element.contains(document.activeElement)), 'Focus escaped the stop confirmation');
  await page.keyboard.press('Escape');
  await stopDialog.waitFor({ state: 'hidden' });
  assert.equal(await shutdown.evaluate(element => element === document.activeElement), true);
  const profileTrigger = page.getByRole('button', { name: /switch profile$/ });
  await profileTrigger.click();
  await page.getByRole('menu').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await profileTrigger.evaluate(element => element === document.activeElement), true);
  // Appearance: Light / Dark / System per profile; accents are built themes, chosen by preset.
  // Tokens are light-dark() pairs, so resolve the accent through a probe element's computed color.
  const accentToken = () => page.getByRole('main').evaluate(element => {
    const probe = document.createElement('i'); probe.style.color = 'var(--color-accent)'; element.append(probe);
    const color = getComputedStyle(probe).color; probe.remove(); return color;
  });
  await navigate('Settings');
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await page.getByRole('radio', { name: 'Blue', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.accent-color.default')), 'blue');
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.theme.default')), 'light');
  assert.equal(await accentToken(), 'rgb(0, 116, 226)');
  await page.screenshot({ path: `${output}/settings-light-blue.png` });
  // A custom hex saved by the glass UI maps to the nearest preset.
  await page.evaluate(() => localStorage.setItem('live-desktop.accent-color.default', '#FFFF00'));
  await page.reload();
  await navigate('Settings');
  assert.equal(await page.getByRole('radio', { name: 'Orange', exact: true }).getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByRole('radio', { name: 'Light', exact: true }).getAttribute('aria-checked'), 'true');
  await page.screenshot({ path: `${output}/settings-light-1440.png` });
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByRole('radio', { name: 'Neutral', exact: true }).click();
  assert.equal(await accentToken(), 'rgb(241, 241, 241)', 'Neutral dark accent is monochrome');
  await page.getByRole('radio', { name: 'System', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('live-desktop.theme.default')), 'system');
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  // Reduce transparency went with the glass shell: no switch, no html attribute.
  assert.equal(await page.getByRole('switch', { name: 'Reduce transparency' }).count(), 0);
  assert.equal(await page.locator('html').getAttribute('data-transparency'), null);
  // Seven destinations, in four groups, each reachable from the side navigation.
  const destinations = /^(Overview|System Info|Conversations|Approvals|Memories|Music|Settings)( \d+ pending)?$/;
  assert.equal(await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: destinations }).count(), 7);
  await navigate('Overview');
  await navigate('Overview');
  assert.match(await page.getByRole('meter', { name: 'Memory used' }).getAttribute('aria-valuetext'), /critical/, 'high memory should use critical severity');
  assert.ok(await page.getByRole('button', { name: /Open Apple Music externally/ }).isVisible(), 'music empty state should offer an external open action');
  assert.ok(await page.getByText('Throughput', { exact: true }).isVisible());
  assert.ok(await page.getByText('Disk activity', { exact: true }).isVisible());
  // Calendar keeps all-day events first; Phone's external open is labelled as external.
  await page.getByText('Synthetic all-day event').waitFor();
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
  assert.equal(await cpuMeter.getAttribute('aria-valuenow'), '0');
  failSystem = false;
  await page.getByRole('button', { name: 'Retry system', exact: true }).click();
  await page.getByRole('button', { name: 'Retry system', exact: true }).waitFor({ state: 'detached' });
  holdSystem = true;
  await page.reload();
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  assert.equal(await cpuMeter.getAttribute('aria-valuetext'), 'Reading unavailable');
  releaseSystem();
  await page.getByRole('switch', { name: 'Wi-Fi: on. Request off', exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 360 });
  await navigate('Settings');
  await scrollView('bottom');
  assert.ok(await page.getByRole('button', { name: 'Open full player', exact: true }).isVisible());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await writeFile(`${output}/browser-redesign.json`, JSON.stringify({ passed: true, browser: browser.version(), matrix, errors, synthetic: true, simulatedZoom: '640x360 CSS viewport approximates 200% of 1280x720; not browser UI zoom' }, null, 2));
  console.log(`PASS: ${matrix.length} view/viewport combinations; scope, draft, dialog, approval dialog, appearance, search, loading, retry and panel checks.`);
} finally { await browser.close(); }
