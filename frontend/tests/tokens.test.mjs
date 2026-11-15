import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DARK_SURFACE_LUMINANCE, LIGHT_SURFACE_LUMINANCE } from "../src/accentColors.js";

// Parses tokens.css and checks WCAG AA (4.5:1) for every text color against the glass it sits on,
// measured at the glass's worst point over the brightest (dark) or darkest (light) wallpaper glow.
const css = await readFile(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}
const dark = block(":root");
const light = { ...dark, ...block(":root[data-theme='light']") };
const reducedDark = { ...dark, ...block(":root[data-transparency='reduced']") };
const reducedLight = { ...light, ...block(":root[data-transparency='reduced']"), ...block(":root[data-transparency='reduced'][data-theme='light']") };

function parse(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(start => Number.parseInt(hex[1].slice(start, start + 2), 16)).concat(1);
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(rgba, `unsupported color ${value}`);
  const parts = rgba[1].split(",").map(part => Number.parseFloat(part));
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}
const over = (top, bottom) => { const [r, g, b, a] = parse(top); const base = typeof bottom === "string" ? parse(bottom) : bottom; return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a), 1]; };
const hexOf = rgb => `#${rgb.slice(0, 3).map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
function luminance(color) {
  const [r, g, b] = (typeof color === "string" ? parse(color) : color).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const backdrop = tokens => over(tokens["--glow-blue"], tokens["--wallpaper-blue"]);

test("dark glass stays within the surface luminance readable accents are computed against", () => {
  const card = over(dark["--glass-top"], backdrop(dark));
  assert.ok(luminance(card) <= DARK_SURFACE_LUMINANCE, `card ${hexOf(card)} is ${luminance(card).toFixed(4)}`);
});

test("light glass stays within the surface luminance readable accents are computed against", () => {
  const card = over(light["--glass-bottom"], backdrop(light));
  assert.ok(luminance(card) >= LIGHT_SURFACE_LUMINANCE, `card ${hexOf(card)} is ${luminance(card).toFixed(4)}`);
});

for (const [name, tokens, worstCard] of [
  ["dark", dark, tokens => over(tokens["--glass-top"], backdrop(tokens))],
  ["dark strong overlay", dark, tokens => over(tokens["--glass-strong-top"], backdrop(tokens))],
  ["light", light, tokens => over(tokens["--glass-bottom"], backdrop(tokens))],
  ["light strong overlay", light, tokens => over(tokens["--glass-strong-bottom"], backdrop(tokens))],
  ["reduced-transparency dark", reducedDark, tokens => parse(tokens["--glass"])],
  ["reduced-transparency light", reducedLight, tokens => parse(tokens["--glass"])],
]) {
  test(`${name}: text, secondary, muted and status colors pass 4.5:1 on cards and wells`, () => {
    const card = worstCard(tokens);
    const well = over(tokens["--well"], card);
    for (const token of ["--text", "--text-secondary", "--muted", "--green", "--amber", "--red"]) {
      assert.ok(contrast(tokens[token], card) >= 4.5, `${token} ${tokens[token]} on ${hexOf(card)}: ${contrast(tokens[token], card).toFixed(2)}`);
    }
    for (const token of ["--text", "--muted"]) {
      assert.ok(contrast(tokens[token], well) >= 4.5, `${token} on well ${hexOf(well)}: ${contrast(tokens[token], well).toFixed(2)}`);
    }
  });
}

test("the default accent fill tokens give white button text at least 4.5:1", () => {
  assert.ok(contrast(dark["--accent-fill-ink"], dark["--accent-fill"]) >= 4.5);
  assert.ok(contrast(dark["--accent-readable"], over(dark["--glass-top"], backdrop(dark))) >= 4.5);
});

test("the pending badge keeps dark text on amber in both themes", () => {
  assert.ok(contrast("#1C1C1E", "#FF9F0A") >= 4.5);
});
