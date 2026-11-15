import test from "node:test";
import assert from "node:assert/strict";
import { ACCENT_PRESETS, accentPreset, nearestAccentPreset, normalizeHexColor, readAccentPreset } from "../src/accentColors.js";
import { readFile } from "node:fs/promises";

test("normalizes full and shorthand hex colors saved by the glass UI", () => {
  assert.equal(normalizeHexColor(" #12abEF "), "#12ABEF");
  assert.equal(normalizeHexColor("#f0a"), "#FF00AA");
  assert.throws(() => normalizeHexColor("1685FF"), /hex color/);
  assert.throws(() => normalizeHexColor("#abcd"), /hex color/);
});

test("every accent preset is a theme registered with astryx theme add", async () => {
  // astryx-themes.js imports theme CSS, so read the generated registry as text instead of importing it.
  const registry = await readFile(new URL("../src/astryx-themes.js", import.meta.url), "utf8");
  for (const preset of ACCENT_PRESETS) assert.match(registry, new RegExp(`"${preset.theme}": _astryxTheme\\d+`), `${preset.id} → ${preset.theme}`);
  assert.equal(accentPreset("missing").id, "neutral");
});

test("maps saved custom hex colors to the nearest accent preset", () => {
  assert.equal(nearestAccentPreset("#0A84FF"), "blue");
  assert.equal(nearestAccentPreset("#FFFF00"), "orange");
  assert.equal(nearestAccentPreset("#22C55E"), "green");
  assert.equal(nearestAccentPreset("#EF4444"), "red");
  assert.equal(nearestAccentPreset("#000000"), "neutral");
  assert.equal(nearestAccentPreset("#FFFFFF"), "neutral");
  assert.equal(nearestAccentPreset("#808080"), "neutral");
});

test("reads a saved accent preset, migrating hex values and ignoring bad ones", () => {
  const storage = value => ({ getItem: () => value });
  assert.equal(readAccentPreset(storage("green"), "k"), "green");
  assert.equal(readAccentPreset(storage("#0A84FF"), "k"), "blue");
  assert.equal(readAccentPreset(storage("not a color"), "k"), "neutral");
  assert.equal(readAccentPreset(storage(null), "k"), "neutral");
});
