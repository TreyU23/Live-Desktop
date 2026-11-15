import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mockDashboard } from './redesign-fixture.mjs';

// Replaces the glass-era tokens.test.mjs: resolves the live Astryx theme tokens in a real browser,
// in light and dark mode for every accent preset, and checks WCAG contrast for the text and
// control pairs the app uses (4.5:1 for text, 3:1 for non-text indicators).
const kText = [
  ['--color-text-primary', '--color-background-body'],
  ['--color-text-secondary', '--color-background-body'],
  ['--color-text-primary', '--color-background-card'],
  ['--color-text-secondary', '--color-background-card'],
  ['--color-text-primary', '--color-background-surface'],
  ['--color-text-secondary', '--color-background-surface'],
  ['--color-on-accent', '--color-accent'],
];
// The SVG instruments (gauge arc, sparkline) draw severity with the icon-* tokens.
const kIndicator = [
  ['--color-icon-success', '--color-background-card'],
  ['--color-icon-warning', '--color-background-card'],
  ['--color-icon-error', '--color-background-card'],
  ['--color-accent', '--color-background-body'],
];
const kPresets = ['neutral', 'blue', 'green', 'orange', 'red'];

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'msedge' }), headless: true });
const url = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4174';
const failures = [];
try {
  for (const mode of ['light', 'dark']) {
    for (const preset of kPresets) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await mockDashboard(page);
      await page.addInitScript(([theme, accent]) => {
        localStorage.setItem('live-desktop.theme.default', theme);
        localStorage.setItem('live-desktop.accent-color.default', accent);
      }, [mode, preset]);
      await page.goto(url);
      await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
      const ratios = await page.getByRole('main').evaluate((main, pairs) => {
        // Resolve any CSS color (oklch, light-dark, color-mix) to sRGB through a canvas pixel.
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const rgb = token => {
          const probe = document.createElement('i'); probe.style.color = `var(${token})`; main.append(probe);
          const color = getComputedStyle(probe).color; probe.remove();
          context.clearRect(0, 0, 1, 1); context.fillStyle = '#000'; context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data; return { rgb: [r, g, b], alpha: a / 255, color };
        };
        const linear = channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        return pairs.map(([fg, bg, minimum]) => {
          const back = rgb(bg); const front = rgb(fg);
          // Translucent foregrounds are composited over their background before measuring.
          const mixed = front.rgb.map((channel, index) => channel * front.alpha + back.rgb[index] * (1 - front.alpha));
          const [high, low] = [luminance(mixed), luminance(back.rgb)].sort((a, b) => b - a);
          return { fg, bg, minimum, ratio: (high + 0.05) / (low + 0.05), front: front.color, back: back.color };
        });
      }, [...kText.map(pair => [...pair, 4.5]), ...kIndicator.map(pair => [...pair, 3])]);
      for (const result of ratios) {
        const line = `${mode}/${preset}: ${result.fg} on ${result.bg} = ${result.ratio.toFixed(2)} (needs ${result.minimum})`;
        if (result.ratio + 1e-6 < result.minimum) failures.push(line);
      }
      await page.close();
    }
  }
  assert.deepEqual(failures, [], `Contrast failures:\n${failures.join('\n')}`);
  console.log(`PASS: theme token contrast in light and dark for ${kPresets.length} accent presets (${kText.length} text pairs, ${kIndicator.length} indicator pairs each).`);
} finally { await browser.close(); }
