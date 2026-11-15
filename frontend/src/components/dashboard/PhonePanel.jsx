import { useState } from 'react';
import { Icon, InfoLine } from '../ui/index.jsx';
import { getPhoneDeviceVisual } from '../../phoneDevice.js';
import { formatRelativeTime } from '../../presentation/formatters.js';
export function PhonePanel({ phone, onOpen, onRefresh, onCopy, busy, refreshing }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ready = phone?.installed;
  const connected = phone?.connected;
  const lastSync = formatRelativeTime(phone?.lastSyncedAt);
  const phoneVisual = getPhoneDeviceVisual(phone);
  return (
    <section className="card overview-card overview-card--phone phone-panel" aria-labelledby="phone-title">
      <div className="identity-row phone-device" data-phone-platform={phoneVisual.platform}>
        <span className="tile tile--40 tile--device">
          {phoneVisual.src ? <img src={phoneVisual.src} alt={phoneVisual.alt} /> : <span className="phone-device-placeholder" role="img" aria-label={phoneVisual.alt}><Icon name="Smartphone" size={20} /></span>}
        </span>
        <div>
          <h2 id="phone-title">{ready ? phone.deviceName || "Linked phone" : "Your phone"}</h2>
          <span className={connected ? "status-label--good" : "muted"}>{phone?.detail || "Phone Link setup available"}</span>
          {ready ? <small className="muted">{[phone.osName, phone.model !== "Unknown" ? phone.model : null].filter(Boolean).join(" · ")}</small> : null}
        </div>
        <button type="button" className="btn-icon btn-icon--plain phone-refresh" aria-label="Refresh Phone Link information" onClick={onRefresh} disabled={refreshing}>
          <Icon name="RefreshCw" size={17} className={refreshing ? "spin" : ""} />
        </button>
      </div>
      <dl className="group phone-live-stats">
        <div><dt>Battery</dt><dd className="group__value--end">{phone?.batteryPercent == null ? "—" : `${phone.batteryPercent}%`}</dd></div>
        <div><dt>Last sync</dt><dd className="group__value--end">{lastSync}</dd></div>
      </dl>
      {detailsOpen ? <><div className="phone-section-title"><strong>Phone Link status</strong><span>Checked {formatRelativeTime(phone?.capturedAt)}</span></div>
      <div className="notification-list">
        {phone?.notificationsAvailable ? (
          <Notification icon="MessageCircle" color="green" label="Notifications available" detail="Open Phone Link only when you want to read private content." time={lastSync} />
        ) : (
          <div className="phone-empty">
            <Icon name="BellOff" size={20} />
            <span>No new notification signal is available.</span>
          </div>
        )}
      </div></> : null}
      {detailsOpen ? <div className="phone-actions" role="group" aria-label="Phone quick actions">
        <PhoneAction icon="RefreshCw" label="Refresh" onClick={onRefresh} disabled={refreshing} />
        <PhoneAction icon="Copy" label="Copy device" onClick={onCopy} disabled={!ready} />
      </div> : null}
      {detailsOpen ? (
        <div className="group phone-details">
          <InfoLine icon="Smartphone" label="Device" value={phone.deviceName || "Linked phone"} />
          <InfoLine icon="Layers3" label="System" value={[phone.osName, phone.model].filter((value) => value && value !== "Unknown").join(" · ") || "Unknown"} />
          <InfoLine icon="Activity" label="Last seen" value={formatRelativeTime(phone.lastSeenAt)} />
        </div>
      ) : null}
      {detailsOpen ? <button className="text-action phone-settings" type="button" onClick={onOpen} disabled={!ready || busy}>
        Open Phone Link externally <Icon name="ExternalLink" size={14} />
      </button> : null}
      <button className="text-action card-footer" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? 'Close phone details' : 'Phone details'} <Icon name="ChevronRight" size={14} /></button>
    </section>
  );
}
function PhoneAction({ icon, label, onClick, disabled, active = false }) {
  return <button className={active ? "active" : ""} type="button" onClick={onClick} disabled={disabled}><Icon name={icon} size={16} /><span>{label}</span></button>;
}
function Notification({ icon, color, label, detail, time }) {
  return (
    <div className="notification-row">
      <span className={`notification-icon notification-icon--${color}`}><Icon name={icon} size={17} /></span>
      <div><strong>{label}</strong><span>{detail}</span></div>
      <time>{time}</time>
    </div>
  );
}
