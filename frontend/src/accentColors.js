export const DEFAULT_ACCENT_COLOR = "#0A84FF";

export const ACCENT_PRESETS = [
  { id: "blue", label: "Blue", color: DEFAULT_ACCENT_COLOR },
  { id: "red", label: "Red", color: "#EF4444" },
  { id: "green", label: "Green", color: "#22C55E" },
  { id: "purple", label: "Purple", color: "#A855F7" },
  { id: "black", label: "Black", color: "#000000" },
];

export function normalizeHexColor(value) {
  const candidate = String(value || "").trim();
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(candidate)) {
    throw new Error("Enter a hex color such as #1685FF or #F0A.");
  }

  const digits = candidate.slice(1);
  const expanded = digits.length === 3
    ? digits.split("").map((digit) => `${digit}${digit}`).join("")
    : digits;
  return `#${expanded.toUpperCase()}`;
}

export function accentSoftColor(value, alpha = 0.16) {
  const color = normalizeHexColor(value);
  const channels = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  return `rgba(${channels.join(", ")}, ${alpha})`;
}

export function effectiveAccentColor(value, darkMode) {
  const color = normalizeHexColor(value);
  return darkMode && color === "#000000" ? "#FFFFFF" : color;
}

export function accentForegroundColor(value) {
  return relativeLuminance(value) > 0.179 ? "#000000" : "#FFFFFF";
}

export function relativeLuminance(value) {
  const color = normalizeHexColor(value);
  const channels = [1, 3, 5].map(start => {
    const channel = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

// Luminance of the lightest glass surface text can sit on (see tokens.css and tokens.test.mjs).
export const DARK_SURFACE_LUMINANCE = 0.03;
export const LIGHT_SURFACE_LUMINANCE = 0.88;

export function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mix(value, target, amount) {
  const color = normalizeHexColor(value);
  const end = normalizeHexColor(target);
  const channel = (hex, start) => Number.parseInt(hex.slice(start, start + 2), 16);
  return `#${[1, 3, 5].map(start => Math.round(channel(color, start) + (channel(end, start) - channel(color, start)) * amount)
    .toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

// Saved colors stay untouched. Text and focus use a readable variant of the same hue:
// lightened on dark glass, darkened on light glass, until it reaches 4.5:1.
export function readableAccentColor(value, darkMode) {
  const color = normalizeHexColor(value);
  const surface = darkMode ? DARK_SURFACE_LUMINANCE : LIGHT_SURFACE_LUMINANCE;
  const target = darkMode ? "#FFFFFF" : "#000000";
  for (let step = 0; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    const luminance = relativeLuminance(candidate);
    if ((Math.max(luminance, surface) + 0.05) / (Math.min(luminance, surface) + 0.05) >= 4.5) return candidate;
  }
  return target;
}

// Filled controls (primary buttons, selected rows, switches). Mid and dark accents are darkened
// just enough for white text; very light accents (yellow, white) keep their fill and use black text.
export function accentFillColor(value) {
  const color = normalizeHexColor(value);
  if (relativeLuminance(color) > 0.4) return color;
  for (let step = 0; step <= 20; step += 1) {
    const candidate = mix(color, "#000000", step / 20);
    if (contrastRatio(candidate, "#FFFFFF") >= 4.5) return candidate;
  }
  return "#000000";
}

export function accentFillForeground(value) {
  return contrastRatio(accentFillColor(value), "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#000000";
}

export function readAccentColor(storage, key) {
  try {
    return normalizeHexColor(storage.getItem(key) || DEFAULT_ACCENT_COLOR);
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}
