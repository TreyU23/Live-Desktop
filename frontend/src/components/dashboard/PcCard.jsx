import { Icon } from '../ui/index.jsx';
import { formatBytesPerSec } from '../../presentation/formatters.js';

// Identity comes from Windows; the device tile is a generic glyph, never a detected model.
export function PcCard({ system, ready, onOpenSystem }) {
  const r = system.resources;
  const networkRates = ready && r.network?.ratesAvailable;
  const diskRates = ready && r.diskActivity?.available;
  const waiting = 'Waiting for system data';
  return <section className="card overview-card overview-card--pc" aria-labelledby="pc-title">
    <div className="identity-row">
      <span className="tile tile--48 tile--device" aria-hidden="true"><Icon name="Monitor" size={26} strokeWidth={1.7} /></span>
      <div><h2 id="pc-title">{ready ? system.host.name : 'This PC'}</h2><span className="muted">{ready ? `${system.host.os} · ${system.host.architecture}` : 'System information unavailable'}</span></div>
    </div>
    <div className="group group--plain" aria-label="Network and disk activity">
      <div><Icon name="Globe2" size={16} className="muted" /><span className="group__value">Network</span><span className={ready && r.network?.connected ? 'status-label--good' : 'muted'}>{ready ? r.network?.connected ? 'Connected' : 'Offline' : 'Unavailable'}</span></div>
      <div><Icon name="Activity" size={16} className="muted" /><span className="group__value">Network throughput</span><span className="data-value">{networkRates ? `↓ ${formatBytesPerSec(r.network.rxBytesPerSec)} · ↑ ${formatBytesPerSec(r.network.txBytesPerSec)}` : ready ? 'Rates unavailable' : waiting}</span></div>
      <div><Icon name="HardDrive" size={16} className="muted" /><span className="group__value">Disk activity</span><span className="data-value">{diskRates ? `R ${formatBytesPerSec(r.diskActivity.readBytesPerSec)} · W ${formatBytesPerSec(r.diskActivity.writeBytesPerSec)}` : ready ? 'Activity unavailable' : waiting}</span></div>
      <div><Icon name="BatteryMedium" size={16} className="muted" /><span className="group__value">Battery</span><span className={ready && r.battery?.available ? '' : 'muted'}>{ready && r.battery?.available && r.battery.percent != null ? `${r.battery.percent}%` : 'Not reported'}</span></div>
    </div>
    <button type="button" className="text-action card-footer" onClick={onOpenSystem}>About this PC <Icon name="ChevronRight" size={14} /></button>
  </section>;
}
