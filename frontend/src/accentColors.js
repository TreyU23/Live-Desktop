// Accent presets (decision 4): each is a built Astryx theme added with `astryx theme add` and
// selected with <Theme theme={themes[slug]}>. Neutral is the theme default and has no hue of its
// own. `swatch` is an Astryx Icon color name; `hue` (degrees) only serves the migration below.
export const ACCENT_PRESETS = [
  { id: "neutral", label: "Neutral", hue: null, theme: "live-desktop", swatch: "primary" },
  { id: "blue", label: "Blue", hue: 210, theme: "live-desktop-blue", swatch: "blue" },
  { id: "green", label: "Green", hue: 105, theme: "live-desktop-green", swatch: "green" },
  { id: "orange", label: "Orange", hue: 35, theme: "live-desktop-orange", swatch: "orange" },
  { id: "red", label: "Red", hue: 357, theme: "live-desktop-red", swatch: "red" },
];
export const DEFAULT_ACCENT_PRESET = "neutral";

// Parses the "#rgb" / "#rrggbb" values the glass UI used to save. Throws on anything else.
export function normalizeHexColor(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) throw new Error("Enter a hex color such as #1685FF.");
  const digits = match[1].length === 3 ? match[1].split("").map(digit => digit + digit).join("") : match[1];
  return `#${digits.toUpperCase()}`;
}

function hueAndSaturation(value) {
  const color = normalizeHexColor(value);
  const [r, g, b] = [1, 3, 5].map(start => Number.parseInt(color.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
  if (!delta) return { hue: 0, saturation: 0 };
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, saturation: delta };
}

// A custom hex saved by the glass UI maps to the closest preset: low-saturation colors
// (black, white, greys) become Neutral, everything else the nearest preset hue.
export function nearestAccentPreset(value) {
  const { hue, saturation } = hueAndSaturation(value);
  if (saturation < 0.2) return DEFAULT_ACCENT_PRESET;
  let best = DEFAULT_ACCENT_PRESET; let bestDistance = Infinity;
  for (const preset of ACCENT_PRESETS) {
    if (preset.hue == null) continue;
    const distance = Math.min(Math.abs(preset.hue - hue), 360 - Math.abs(preset.hue - hue));
    if (distance < bestDistance) { best = preset.id; bestDistance = distance; }
  }
  return best;
}

export function accentPreset(id) {
  return ACCENT_PRESETS.find(preset => preset.id === id) || ACCENT_PRESETS[0];
}

// Saved value is a preset id; an older hex value is migrated to its nearest preset.
export function readAccentPreset(storage, key) {
  const saved = storage.getItem(key);
  if (ACCENT_PRESETS.some(preset => preset.id === saved)) return saved;
  try { return saved ? nearestAccentPreset(saved) : DEFAULT_ACCENT_PRESET; } catch { return DEFAULT_ACCENT_PRESET; }
}
