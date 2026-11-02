export function ResourceGauge({ label, value, detail }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  const fill = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className={`resource-gauge ${available ? '' : 'resource-gauge--unavailable'}`}>
    <svg viewBox="0 0 180 180" aria-hidden="true">
      <circle className="gauge-track" cx="90" cy="90" r="80" />
      {available ? <circle className="gauge-fill" cx="90" cy="90" r="80" pathLength="100" strokeDasharray={`${fill} 100`} transform="rotate(-90 90 90)" /> : null}
    </svg>
    <div className="gauge-value"><span>{label}</span><strong>{available ? Math.round(value) : '—'}{available ? <small>%</small> : null}</strong><p>{!available && value != null ? `Invalid reading: ${value}` : detail}</p></div>
  </div>;
}
