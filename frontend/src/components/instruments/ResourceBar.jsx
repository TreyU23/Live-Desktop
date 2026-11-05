import { utilizationSeverity, utilizationSeverityClass } from '../../presentation/utilizationSeverity.js';

export function ResourceBar({ label, value, detail }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  const severity = available ? utilizationSeverity(value) : null;
  return <div className={`resource-bar ${utilizationSeverityClass(value, 'resource-bar')}`.trim()}><div><span>{label}</span><strong>{available ? `${Math.round(value)}%` : '—'}</strong></div>
    <div className="resource-bar__track" aria-hidden="true">{available ? <i className={severity ? `resource-bar__fill--${severity}` : undefined} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /> : null}</div>
    <small>{available ? detail : value == null ? 'Reading unavailable' : `Invalid reading: ${value}`}</small>
  </div>;
}
