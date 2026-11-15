import { utilizationSeverity } from '../../presentation/utilizationSeverity.js';

// Bespoke SVG instrument (the sanctioned exception to "no raw elements"): Astryx has no gauge.
// A 240° open-bottom arc with a truthful fill: empty at 0, full at 100, no fill and an em dash
// when the reading is missing. Colors come only from theme tokens; it has no stylesheet.
const kArc = 'M 16.70 85.00 A 50 50 0 1 1 103.30 85.00';
const kStroke = { normal: 'var(--color-success)', elevated: 'var(--color-warning)', critical: 'var(--color-error)' };

export function ResourceGauge({ label, value, size = 148 }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  const severity = available ? utilizationSeverity(value) : null;
  const rounded = available ? Math.round(value) : null;
  const valueText = available ? `${rounded} percent, ${severity}` : value == null ? 'Reading unavailable' : `Invalid reading: ${value}`;
  return <svg role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={available ? rounded : undefined} aria-valuetext={valueText}
    width={size} height={Math.round(size * 101 / 120)} viewBox="0 0 120 101" fill="none" focusable="false">
    <path d={kArc} stroke="var(--color-neutral)" strokeWidth="9" strokeLinecap="round" />
    {available && value > 0 ? <path d={kArc} pathLength="100" strokeDasharray={`${value} 100`} stroke={kStroke[severity]} strokeWidth="9" strokeLinecap="round" /> : null}
    <text x="60" y="66" textAnchor="middle" fill="var(--color-text-primary)" fontSize="26" fontWeight="600" fontFamily="inherit" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {available ? rounded : '—'}
      {available ? <tspan fontSize="12" fill="var(--color-text-secondary)" dx="2">%</tspan> : null}
    </text>
  </svg>;
}
