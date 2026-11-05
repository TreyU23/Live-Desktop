export function Sparkline({ values = [], label, severity = null }) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) {
    return (
      <div className="sparkline sparkline--empty" aria-hidden="true">
        <svg viewBox="0 0 120 28" preserveAspectRatio="none">
          <line className="sparkline-baseline" x1="0" y1="14" x2="120" y2="14" />
        </svg>
      </div>
    );
  }

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      if (!Number.isFinite(value)) return null;
      const x = (index / Math.max(values.length - 1, 1)) * 120;
      const y = 24 - ((value - min) / span) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`sparkline${severity ? ` sparkline--${severity}` : ""}`} role="img" aria-label={label || "Trend"}>
      <svg viewBox="0 0 120 28" preserveAspectRatio="none">
        <polyline className="sparkline-line" fill="none" points={points} />
      </svg>
    </div>
  );
}
