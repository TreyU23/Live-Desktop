import test from "node:test";
import assert from "node:assert/strict";
import { accentFillColor, accentFillForeground, contrastRatio, DARK_SURFACE_LUMINANCE, LIGHT_SURFACE_LUMINANCE, accentForegroundColor, accentSoftColor, DEFAULT_ACCENT_COLOR, effectiveAccentColor, normalizeHexColor, readAccentColor, relativeLuminance, readableAccentColor } from "../src/accentColors.js";

test("normalizes full and shorthand hex colors", () => {
  assert.equal(normalizeHexColor(" #12abEF "), "#12ABEF");
  assert.equal(normalizeHexColor("#f0a"), "#FF00AA");
});

test("rejects invalid custom accent colors", () => {
  assert.throws(() => normalizeHexColor("1685FF"), /hex color/);
  assert.throws(() => normalizeHexColor("#abcd"), /hex color/);
});

test("creates the soft accent token from the selected color", () => {
  assert.equal(accentSoftColor("#1685ff"), "rgba(22, 133, 255, 0.16)");
});

test("renders the black preference as white only in dark mode", () => {
  assert.equal(effectiveAccentColor("#000000", true), "#FFFFFF");
  assert.equal(effectiveAccentColor("#000000", false), "#000000");
  assert.equal(effectiveAccentColor("#A855F7", true), "#A855F7");
});

test("uses black foreground content on the adaptive white accent", () => {
  assert.equal(accentForegroundColor("#FFFFFF"), "#000000");
  assert.equal(accentForegroundColor("#1685FF"), "#000000");
});

test('custom accent foregrounds meet 4.5:1 and readable variants retain contrast', () => {
  for (const color of ['#FFFFFE', '#010101', '#FFFF00', '#4A9AFF', '#A855F7', '#12AB34']) {
    const fill = relativeLuminance(color);
    const ink = relativeLuminance(accentForegroundColor(color));
    assert.ok((Math.max(fill, ink) + .05) / (Math.min(fill, ink) + .05) >= 4.5, color);
    for (const dark of [true, false]) {
      const readable = relativeLuminance(readableAccentColor(color, dark));
      const surface = dark ? DARK_SURFACE_LUMINANCE : LIGHT_SURFACE_LUMINANCE;
      assert.ok((Math.max(readable, surface) + .05) / (Math.min(readable, surface) + .05) >= 4.5);
    }
  }
});

test("readable accents keep the chosen hue instead of a fixed fallback", () => {
  const readable = readableAccentColor("#0A84FF", true);
  assert.notEqual(readable, "#0A84FF");
  const [r, g, b] = [1, 3, 5].map(start => Number.parseInt(readable.slice(start, start + 2), 16));
  assert.ok(b > g && g > r, `${readable} should stay blue`);
});

test("accent fills carry readable button text for every preset and custom color", () => {
  for (const color of ["#0A84FF", "#EF4444", "#22C55E", "#A855F7", "#000000", "#FFFFFF", "#FFFF00", "#12AB34", "#4A9AFF"]) {
    const fill = accentFillColor(color);
    assert.ok(contrastRatio(fill, accentFillForeground(color)) >= 4.5, color);
  }
  assert.equal(accentFillForeground("#0A84FF"), "#FFFFFF");
  assert.equal(accentFillForeground("#FFFF00"), "#000000");
});

test("tokens.css default accent values match what App.jsx computes for the default accent", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  const token = name => css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))[1].toUpperCase();
  assert.equal(token("--accent"), DEFAULT_ACCENT_COLOR);
  assert.equal(token("--accent-readable"), readableAccentColor(DEFAULT_ACCENT_COLOR, true));
  assert.equal(token("--accent-fill"), accentFillColor(DEFAULT_ACCENT_COLOR));
  assert.equal(token("--accent-fill-ink"), accentFillForeground(DEFAULT_ACCENT_COLOR));
  assert.equal(token("--accent-foreground"), accentForegroundColor(DEFAULT_ACCENT_COLOR));
});

test("falls back to blue when the saved color is invalid", () => {
  const storage = { getItem: () => "not-a-color" };
  assert.equal(readAccentColor(storage, "accent"), DEFAULT_ACCENT_COLOR);
});
