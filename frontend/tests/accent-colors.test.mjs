import test from "node:test";
import assert from "node:assert/strict";
import { accentForegroundColor, accentSoftColor, DEFAULT_ACCENT_COLOR, effectiveAccentColor, normalizeHexColor, readAccentColor, relativeLuminance, readableAccentColor } from "../src/accentColors.js";

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
      const surface = dark ? .0036 : .95;
      assert.ok((Math.max(readable, surface) + .05) / (Math.min(readable, surface) + .05) >= 4.5);
    }
  }
});

test("falls back to blue when the saved color is invalid", () => {
  const storage = { getItem: () => "not-a-color" };
  assert.equal(readAccentColor(storage, "accent"), DEFAULT_ACCENT_COLOR);
});
