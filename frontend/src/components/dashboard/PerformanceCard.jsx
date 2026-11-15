import { Icon } from '../ui/index.jsx';
import { ResourceGauge } from '../instruments/ResourceGauge.jsx';
import { formatBytes, formatRelativeTime } from '../../presentation/formatters.js';

export function PerformanceCard({ system, ready, series = [], onOpenSystem }) {
  const r = system.resources;
  const ratio = (used, total) => ready && Number.isFinite(used) && total > 0 ? used / total * 100 : null;
  const seriesValues = key => series.map(sample => sample[key]);
  return <section className="card overview-card overview-card--performance" aria-labelledby="performance-title">
    <div className="card-header">
      <h2 id="performance-title">Performance</h2>
      <span className="card-header__meta">{!ready ? 'Waiting for system data' : system.capturedAt ? `Updated ${formatRelativeTime(system.capturedAt)}` : 'Live readings'}</span>
      <button type="button" className="text-action" onClick={onOpenSystem}>System Info <Icon name="ChevronRight" size={14} /></button>
    </div>
    <div className="instrument-grid">
      <ResourceGauge label="CPU load" value={ready ? r.cpuPercent : null} detail={ready ? 'Current utilization' : 'Waiting for system data'} series={seriesValues('cpu')} />
      <ResourceGauge label="Memory used" value={ratio(r.memoryUsedBytes, r.memoryTotalBytes)} detail={ready && r.memoryTotalBytes > 0 ? `${formatBytes(r.memoryUsedBytes)} / ${formatBytes(r.memoryTotalBytes)}` : 'Memory unavailable'} series={seriesValues('memory')} />
      <ResourceGauge label="Storage used" value={ratio(r.storageUsedBytes, r.storageTotalBytes)} detail={ready && r.storageTotalBytes > 0 ? `${formatBytes(r.storageUsedBytes)} / ${formatBytes(r.storageTotalBytes)}` : 'Storage unavailable'} series={seriesValues('storage')} />
    </div>
  </section>;
}
