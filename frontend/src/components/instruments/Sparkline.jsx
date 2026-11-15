// Bespoke SVG instrument (the sanctioned exception to "no raw elements"): Astryx has no sparkline.
// Colors come only from theme tokens; it has no stylesheet of its own.
const kStroke = {
  normal: 'var(--color-success)',
  elevated: 'var(--color-warning)',
  critical: 'var(--color-error)',
};
const kWidth = 120;
const kHeight = 28;

export function Sparkline({ values = [], label, severity = null, width = kWidth }) {
  const finite = values.filter(value => Number.isFinite(value));
  if (finite.length < 2) {
    // Not enough samples yet: a flat baseline, hidden from assistive tech (the reading itself is labelled elsewhere).
    return <svg width={width} height={kHeight} viewBox={`0 0 ${kWidth} ${kHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" y1={kHeight / 2} x2={kWidth} y2={kHeight / 2} stroke="var(--color-border)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
    </svg>;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      if (!Number.isFinite(value)) return null;
      const x = (index / Math.max(values.length - 1, 1)) * kWidth;
      const y = kHeight - 4 - ((value - min) / span) * (kHeight - 8);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(' ');
  return <svg width={width} height={kHeight} viewBox={`0 0 ${kWidth} ${kHeight}`} preserveAspectRatio="none" role="img" aria-label={label || 'Trend'} focusable="false">
    <polyline points={points} fill="none" stroke={kStroke[severity] || 'var(--color-text-secondary)'} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
