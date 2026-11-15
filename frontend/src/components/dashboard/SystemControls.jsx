import { Icon } from '../ui/index.jsx';
const controlIcons = { wifi: 'Wifi', bluetooth: 'Bluetooth', focus: 'Moon', 'night-light': 'Sun', microphone: 'Mic', 'battery-saver': 'BatteryMedium' };

// Direct controls (radios) change Windows through an approved action. Everything else only opens
// Windows Settings, so those render as launchers and say so in both caption and accessible name.
export function SystemControls({ controls, pendingControl, onControl, onApprovals, pendingCount }) {
  const direct = controls.filter(control => control.direct);
  const launchers = controls.filter(control => !control.direct);
  const busy = pendingControl != null;
  return <section className="card overview-card overview-card--controls" aria-labelledby="controls-title">
    <h2 id="controls-title">Controls</h2>
    <div id="system-controls" className="control-switches" tabIndex={-1} aria-label="Direct controls" role="group">
      {direct.map(control => <button key={control.id} type="button" role="switch" aria-checked={control.enabled}
        className={`control-tile ${control.enabled ? 'control-tile--on' : ''}`}
        aria-label={!control.available ? `${control.label}: unavailable` : `${control.label}: ${control.enabled ? 'on' : 'off'}. Request ${control.enabled ? 'off' : 'on'}`}
        disabled={!control.available || busy} onClick={() => onControl(control.id)}>
        <span className="toggle-orb" aria-hidden="true"><Icon name={pendingControl === control.id ? 'LoaderCircle' : controlIcons[control.id] || 'Settings'} size={18} strokeWidth={2.2} className={pendingControl === control.id ? 'spin' : ''} /></span>
        <span><strong>{control.label}</strong><small>{pendingControl === control.id ? 'Submitting…' : !control.available ? 'Unavailable' : `${control.enabled ? 'On' : 'Off'} · ${control.detail}`}</small></span>
      </button>)}
    </div>
    {launchers.length ? <>
      <p className="inline-caption"><Icon name="ArrowUpRight" size={12} strokeWidth={2.4} />These open Windows Settings — Live Desktop doesn’t change them directly</p>
      <div className="control-launchers" role="group" aria-label="Windows Settings shortcuts">
        {launchers.map(control => <button key={control.id} type="button" className="launcher-tile"
          aria-label={!control.available ? `${control.label}: unavailable` : `Open ${control.label} in Windows Settings externally`}
          title={control.detail} disabled={!control.available || busy} onClick={() => onControl(control.id)}>
          <span className="toggle-orb" aria-hidden="true"><Icon name={pendingControl === control.id ? 'LoaderCircle' : controlIcons[control.id] || 'Settings'} size={17} className={pendingControl === control.id ? 'spin' : ''} /></span>
          <span>{pendingControl === control.id ? 'Submitting…' : control.label}</span>
        </button>)}
      </div>
    </> : null}
    {pendingCount ? <button type="button" className="notice-banner capability-notice" onClick={onApprovals}>
      <Icon name="Shield" size={20} /><span><strong>{pendingCount} action{pendingCount === 1 ? '' : 's'} waiting for approval</strong><small>Nothing runs on your PC until you allow it. Approval also covers later matching requests.</small></span><span>Review</span>
    </button> : <p className="inline-caption"><Icon name="ShieldCheck" size={14} />No actions waiting for approval. <button type="button" className="text-action" onClick={onApprovals}>Approvals</button></p>}
  </section>;
}
