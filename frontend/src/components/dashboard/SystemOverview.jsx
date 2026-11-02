import { Icon, InfoLine } from '../ui/index.jsx';
import { ResourceGauge } from '../instruments/ResourceGauge.jsx';
import { formatBytes } from '../../presentation/formatters.js';
export function SystemOverview({ system, ready, connected, configured, calendar, musicPlayer, onOpenSystem }) {
  const r = system.resources;
  const ratio = (used, total) => ready && Number.isFinite(used) && total > 0 ? used / total * 100 : null;
  return <section className="system-overview" aria-label="PC overview">
    <div className="instrument-grid">
      <ResourceGauge label="CPU load" value={ready ? r.cpuPercent : null} detail={ready ? 'Current utilization' : 'Waiting for system data'} />
      <ResourceGauge label="Memory used" value={ratio(r.memoryUsedBytes, r.memoryTotalBytes)} detail={ready && r.memoryTotalBytes > 0 ? `${formatBytes(r.memoryUsedBytes)} / ${formatBytes(r.memoryTotalBytes)}` : 'Memory unavailable'} />
      <ResourceGauge label="Storage used" value={ratio(r.storageUsedBytes, r.storageTotalBytes)} detail={ready && r.storageTotalBytes > 0 ? `${formatBytes(r.storageUsedBytes)} / ${formatBytes(r.storageTotalBytes)}` : 'Storage unavailable'} />
    </div>
    <div className="equipment-identity">
      <div><span>Network</span><strong>{ready ? r.network?.connected ? 'Connected' : 'Offline' : 'Unavailable'}</strong><p>{ready ? r.network?.name : 'Waiting for system data'}</p></div>
      <div className="pc-identity">
        <img className="pc-illustration" src="/assets/workstation-v2.png" width="1536" height="1024" alt="Illustrative graphite workstation, not a detected hardware model" />
        <h2>{ready ? system.host.name : 'This PC'}</h2>
        <p>{ready ? `${system.host.os} · ${system.host.architecture}` : 'System information unavailable'}</p>
        <button type="button" className="text-action" onClick={onOpenSystem}>System details <Icon name="ChevronRight" size={14} /></button>
      </div>
      <div><span>Power</span><strong>{ready && r.battery?.available && r.battery.percent != null ? `${r.battery.percent}%` : 'Not reported'}</strong><p>{ready ? r.battery?.detail || 'Power information unavailable' : 'Waiting for system data'}</p></div>
    </div>
    <section className="connection-list" aria-label="Connections"><h3>Connections</h3>
      <InfoLine icon="Layers3" label="Backend" value={connected ? 'Local API available' : 'Unavailable'} healthy={connected} />
      <InfoLine icon="Bot" label="OpenAI key" value={configured ? 'Key configured' : 'Not configured'} />
      <InfoLine icon="CalendarDays" label="iCloud" value={calendar.connected ? 'Connected' : 'Not connected'} />
      <InfoLine icon="Music2" label="Music session" value={musicPlayer.available ? 'Available' : 'Not playing'} />
    </section>
  </section>;
}
