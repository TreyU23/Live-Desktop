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
    <aside className="phone-panel" aria-labelledby="phone-title">
      <div className="phone-title-row">
        <div><Icon name="Smartphone" size={18} /><h2 id="phone-title">Your phone</h2></div>
        <button type="button" className="phone-refresh" aria-label="Refresh Phone Link information" onClick={onRefresh} disabled={refreshing}>
          <Icon name="RefreshCw" size={19} className={refreshing ? "spin" : ""} />
        </button>
      </div>
      <div className="phone-device" data-phone-platform={phoneVisual.platform}>
        {phoneVisual.src ? (
          <img src={phoneVisual.src} alt={phoneVisual.alt} />
        ) : (
          <span className="phone-device-placeholder" role="img" aria-label={phoneVisual.alt}>
            <Icon name="Smartphone" size={46} />
          </span>
        )}
        <div>
          <h3>{ready ? phone.deviceName || "Linked phone" : "Connect your phone"}</h3>
          <span className={connected ? "connected" : "muted"}><i /> {phone?.detail || "Phone Link setup available"}</span>
          {ready ? <small>{[phone.osName, phone.model !== "Unknown" ? phone.model : null].filter(Boolean).join(" · ")}</small> : null}
        </div>
      </div>
      <div className="phone-live-stats">
        <div><span>Battery</span><strong>{phone?.batteryPercent == null ? "—" : `${phone.batteryPercent}%`}</strong></div>
        <div><span>Last sync</span><strong>{lastSync}</strong></div>
      </div>
      {detailsOpen ? <><div className="phone-section-title"><strong>Phone Link status</strong><span>Checked {formatRelativeTime(phone?.capturedAt)}</span></div>
      <div className="notification-list">
        {phone?.notificationsAvailable ? (
          <Notification icon="MessageCircle" color="green" label="Notifications available" detail="Open Phone Link only when you want to read private content." time={lastSync} />
        ) : (
          <div className="phone-empty">
            <Icon name="BellOff" size={22} />
            <span>No new notification signal is available.</span>
          </div>
        )}
      </div></> : null}
      <button className="text-action" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? 'Close phone details' : 'Phone details'} <Icon name="ChevronRight" size={14} /></button>
      {detailsOpen ? <div className="phone-actions">
        <strong>Quick actions</strong>
        <div>
          <PhoneAction icon="RefreshCw" label="Refresh" onClick={onRefresh} disabled={refreshing} />
          <PhoneAction icon="Copy" label="Copy device" onClick={onCopy} disabled={!ready} />
          <PhoneAction icon="ExternalLink" label="Open externally" onClick={onOpen} disabled={!ready || busy} />
        </div>
      </div> : null}
      {detailsOpen ? (
        <div className="phone-details">
          <InfoLine icon="Smartphone" label="Device" value={phone.deviceName || "Linked phone"} />
          <InfoLine icon="Layers3" label="System" value={[phone.osName, phone.model].filter((value) => value && value !== "Unknown").join(" · ") || "Unknown"} />
          <InfoLine icon="Activity" label="Last seen" value={formatRelativeTime(phone.lastSeenAt)} />
        </div>
      ) : null}
      {detailsOpen ? <button className="text-action phone-settings" type="button" onClick={onOpen} disabled={!ready || busy}>
        Open Phone Link externally <Icon name="ExternalLink" size={14} />
      </button> : null}
    </aside>
  );
}
function PhoneAction({ icon, label, onClick, disabled, active = false }) {
  return <button className={active ? "active" : ""} type="button" aria-expanded={label === 'Details' ? active : undefined} onClick={onClick} disabled={disabled}><Icon name={icon} size={18} /><span>{label}</span></button>;
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
