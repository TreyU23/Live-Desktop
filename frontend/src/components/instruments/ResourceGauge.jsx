export function ResourceGauge({ label, value, detail }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  return <div className={`resource-gauge ${available ? '' : 'resource-gauge--unavailable'}`}>
    <span className="gauge-label">{label}</span>
    <div className="gauge-instrument">
      <svg viewBox="0 0 180 145" aria-hidden="true">
        {/* 240 degrees from lower left through the top to lower right. */}
        <path className="gauge-track" d="M 20.718 130 A 80 80 0 1 1 159.282 130" />
        {available && value > 0 ? <path className="gauge-fill" d="M 20.718 130 A 80 80 0 1 1 159.282 130" pathLength="100" strokeDasharray={`${value} 100`} /> : null}
      </svg>
      <div className="gauge-value"><strong>{available ? Math.round(value) : '—'}{available ? <small>%</small> : null}</strong></div>
    </div>
    <p className="gauge-detail">{!available && value != null ? `Invalid reading: ${value}` : detail}</p>
  </div>;
}
