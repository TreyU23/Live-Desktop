import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { mockDashboard } from './redesign-fixture.mjs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { transformSync } = require(require.resolve('esbuild', { paths: [require.resolve('vite/package.json')] }));
const commit = '5d7539fed256744b56b0a7201cab773a3adc530c';
const git = file => execFileSync('git', ['show', `${commit}:frontend/src/${file}`], { encoding: 'utf8' });
const source = transformSync(git('App.jsx').replace(/import \{([^}]+)\} from "react";/, 'import React from "react"; const {$1} = React;'), { loader: 'jsx', jsxFactory: 'React.createElement', define: { 'import.meta.env.VITE_API_BASE': '""' } }).code.replaceAll('"react"', '"/node_modules/.vite/deps/react.js"').replaceAll('"react-icons/fi"', '"/node_modules/.vite/deps/react-icons_fi.js"').replaceAll('from "./', 'from "/src/');
const out = 'backend/target/redesign/baseline';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => console.error(error.message));
  await mockDashboard(page);
  await page.route(/\/src\/App.jsx(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: source }));
  await page.route(/\/src\/accentColors.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: git('accentColors.js') }));
  await page.route(/\/src\/styles.css(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: `import { updateStyle } from '/@vite/client'; updateStyle('baseline-css', ${JSON.stringify(git('styles.css'))});` }));
  await page.goto((process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174') + '/');
  await page.getByText('Local mode', { exact: true }).waitFor({ state: 'attached' });
  for (const [id, name] of [['home', null], ['system', 'System Info'], ['music', 'Music'], ['approvals', 'Approvals'], ['memories', 'Memories'], ['conversations', 'Conversations'], ['settings', 'Settings']]) {
    if (name) await page.getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
    await page.screenshot({ path: `${out}/${id}.png`, fullPage: true });
  }
  console.log(`Baseline: 5d7539fed256744b56b0a7201cab773a3adc530c; ${await browser.version()}; ${out}`);
} finally { await browser.close(); }

