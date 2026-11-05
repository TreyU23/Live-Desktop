import { utilizationSeverity, utilizationSeverityClass } from '../../presentation/utilizationSeverity.js';
import { Sparkline } from './Sparkline.jsx';

export function ResourceGauge({ label, value, detail, series = null }) {
  const available = Number.isFinite(value) && value >= 0 && value <= 100;
  const severity = available ? utilizationSeverity(value) : null;
  return <div className={`resource-gauge ${available ? '' : 'resource-gauge--unavailable'} ${utilizationSeverityClass(value)}`.trim()}>
    <span className="gauge-label">{label}</span>
    <div className="gauge-instrument">
      <svg viewBox="0 0 180 145" aria-hidden="true">
        {/* 240 degrees from lower left through the top to lower right. */}
        <path className="gauge-track" d="M 20.718 130 A 80 80 0 1 1 159.282 130" />
        {available && value > 0 ? <path className={`gauge-fill${severity ? ` gauge-fill--${severity}` : ''}`} d="M 20.718 130 A 80 80 0 1 1 159.282 130" pathLength="100" strokeDasharray={`${value} 100`} /> : null}
      </svg>
      <div className="gauge-value"><strong>{available ? Math.round(value) : '—'}{available ? <small>%</small> : null}</strong></div>
    </div>
    <p className="gauge-detail">{!available && value != null ? `Invalid reading: ${value}` : detail}</p>
    {series ? <Sparkline values={series} label={`${label} trend`} severity={severity} /> : null}
  </div>;
}
