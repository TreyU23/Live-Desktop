export const DEFAULT_ACCENT_COLOR = "#4A9AFF";

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

// Saved colors stay untouched. Text and focus use a readable semantic variant.
export function readableAccentColor(value, darkMode) {
  const luminance = relativeLuminance(value);
  const background = darkMode ? 0.0036 : 0.95;
  const contrast = (Math.max(luminance, background) + 0.05) / (Math.min(luminance, background) + 0.05);
  return contrast >= 4.5 ? value : darkMode ? '#A8CCFF' : '#174C8C';
}

export function readAccentColor(storage, key) {
  try {
    return normalizeHexColor(storage.getItem(key) || DEFAULT_ACCENT_COLOR);
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}
