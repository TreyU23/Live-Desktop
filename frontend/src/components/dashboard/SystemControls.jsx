import { Icon } from '../ui/index.jsx';
const controlIcons = { wifi: 'Wifi', bluetooth: 'Bluetooth', focus: 'BellOff', 'night-light': 'Sun', microphone: 'Mic', 'battery-saver': 'BatteryMedium' };
export function SystemControls({ controls, pendingControl, onControl, onApprovals, pendingCount }) {
  return <aside className="control-rail"><h2>System controls</h2><section id="system-controls" className="control-strip" aria-label="System controls" tabIndex={-1}>
    {controls.map(control => <div className="control-item" key={control.id}>
      <Icon name={controlIcons[control.id] || 'Settings'} /><div><strong>{control.label}</strong><span>{control.detail}</span></div>
      <button className={`control-button ${control.enabled && control.direct ? 'control-button--on' : ''}`} type="button"
        role={control.direct ? 'switch' : undefined} aria-checked={control.direct ? control.enabled : undefined}
        aria-label={!control.available ? `${control.label}: unavailable` : control.direct ? `${control.label}: ${control.enabled ? 'on' : 'off'}. Request ${control.enabled ? 'off' : 'on'}` : `Open ${control.label} in Windows Settings externally`}
        disabled={!control.available || pendingControl != null} onClick={() => onControl(control.id)}>
        {pendingControl === control.id ? 'Submitting…' : !control.available ? 'Unavailable' : control.direct ? control.enabled ? 'On' : 'Off' : <><Icon name="ExternalLink" size={14} />Open Settings</>}
      </button>
    </div>)}
  </section><p className="control-explanation">On / off controls act in Live Desktop. Open Settings launches Windows Settings externally.</p>
    <button className="capability-notice" type="button" onClick={onApprovals}><Icon name="Shield" size={16} /><span>{pendingCount ? `${pendingCount} pending approval${pendingCount === 1 ? '' : 's'}` : 'Review device permissions'}<small>Approval covers later matching actions.</small></span><Icon name="ChevronRight" size={14} /></button>
  </aside>;
}
