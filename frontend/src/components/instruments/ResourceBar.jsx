export function ResourceBar({ label, value, detail }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  return <div className="resource-bar"><div><span>{label}</span><strong>{available ? `${Math.round(value)}%` : '—'}</strong></div>
    <div className="resource-bar__track" aria-hidden="true">{available ? <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /> : null}</div>
    <small>{available ? detail : value == null ? 'Reading unavailable' : `Invalid reading: ${value}`}</small>
  </div>;
}
