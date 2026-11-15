import { useState } from 'react';
import { Icon, DetailRows, PageHeading } from '../components/ui/index.jsx';
import { formatBytes, formatBytesPerSec, percent, formatInstalledDate, formatPercent } from '../presentation/formatters.js';
import { ResourceBar } from '../components/instruments/ResourceBar.jsx';
import { Sparkline } from '../components/instruments/Sparkline.jsx';
import { utilizationSeverity } from '../presentation/utilizationSeverity.js';
export function SystemInfoView({ system, series = [], connected, configured, onCopy, headerActions }) {
  const [tab, setTab] = useState('live');
  const [showIds, setShowIds] = useState(false);
  const seriesValues = key => series.map(sample => sample[key]);
  const resources = system.resources;
  const device = system.device || {};
  const windows = system.windows || {};
  const graphics = device.graphics?.length ? device.graphics : [{ name: "Unavailable", driverVersion: "Unavailable" }];
  const memoryPercent = percent(resources.memoryUsedBytes, resources.memoryTotalBytes);
  const storagePercent = percent(resources.storageUsedBytes, resources.storageTotalBytes);
  const processorDetail = [
    device.processorCores ? `${device.processorCores} cores` : null,
    device.processorLogicalProcessors ? `${device.processorLogicalProcessors} logical processors` : null,
    device.maxClockMhz ? `${(device.maxClockMhz / 1000).toFixed(2)} GHz max` : null,
  ].filter(Boolean).join(" · ") || "Windows processor information unavailable";
  const deviceRows = [
    { label: "Device name", value: system.host.name },
    { label: "Manufacturer", value: device.manufacturer },
    { label: "Model", value: device.model },
    { label: "Processor", value: device.processorName },
    { label: "Installed RAM", value: formatBytes(device.installedMemoryBytes || resources.memoryTotalBytes) },
    { label: "Graphics", value: graphics.map((item) => item.name).join(", ") },
    { label: "System type", value: device.systemType },
    { label: "Device ID", value: showIds ? device.deviceId : "Hidden" },
    { label: "Product ID", value: showIds ? device.productId : "Hidden" },
  ];
  const windowsRows = [
    { label: "Edition", value: windows.edition },
    { label: "Version", value: windows.version },
    { label: "Installed on", value: formatInstalledDate(windows.installedOn) },
    { label: "OS build", value: windows.build },
    { label: "OS version", value: windows.osVersion },
    { label: "Architecture", value: windows.architecture },
  ];
  const liveRows = [
    { label: "Network", value: resources.network.connected ? `${resources.network.name} · ${resources.network.address}` : "Offline" },
    { label: "Battery", value: resources.battery.available ? `${resources.battery.percent}% · ${resources.battery.detail}` : resources.battery.detail },
    { label: "Backend", value: connected ? "Local API connected" : "Unavailable" },
    { label: "OpenAI", value: configured ? "Key configured" : "API key needed" },
    { label: "Java runtime", value: `Java ${system.host.javaVersion}` },
    { label: "Last refreshed", value: system.capturedAt ? new Date(system.capturedAt).toLocaleString() : "Not yet received" },
  ];

  const network = resources.network || {};
  const disk = resources.diskActivity || {};
  const summaryRows = [
    { label: "Processor", value: device.processorName },
    { label: "Memory", value: formatBytes(device.installedMemoryBytes || resources.memoryTotalBytes) },
    { label: "Graphics", value: graphics[0].name },
    { label: "Storage", value: formatBytes(resources.storageTotalBytes, 0) },
  ];

  return (
    <main className="system-info-view">
      <PageHeading title="About this PC" detail="Device specifications, Windows information, and live resource status reported by this PC." actions={headerActions}>
        <span className={`status-label ${connected ? "status-label--good" : "status-label--warn"}`}><Icon name={connected ? "CircleCheck" : "CircleAlert"} size={14} />{connected ? "Live Windows data" : "Backend unavailable"}</span>
      </PageHeading>
      <div className="segmented system-tabs" role="tablist" aria-label="System information">
        <button type="button" role="tab" id="system-tab-live" aria-selected={tab === "live"} aria-controls="system-panel" onClick={() => setTab("live")}>Live</button>
        <button type="button" role="tab" id="system-tab-specs" aria-selected={tab === "specs"} aria-controls="system-panel" onClick={() => setTab("specs")}>Specifications</button>
      </div>
      <div id="system-panel" role="tabpanel" aria-labelledby={tab === "live" ? "system-tab-live" : "system-tab-specs"}>
      {tab === "live" ? <div className="system-live-grid">
        <section className="card system-identity-card" aria-labelledby="system-identity-title">
          <img className="pc-illustration" src="/assets/workstation-v2.png" width="1536" height="1024" alt="Illustrative graphite workstation, not a detected hardware model" />
          <div><h2 id="system-identity-title">{system.host.name}</h2><span className="muted">{[device.manufacturer, device.model].filter(value => value && value !== "Unavailable").join(" ") || "Model unavailable"} · {windows.edition || system.host.os}</span></div>
          <dl className="group">{summaryRows.map(row => <div key={row.label}><dt>{row.label}</dt><dd title={String(row.value)}>{row.value}</dd></div>)}</dl>
          <button className="btn-pill" type="button" onClick={onCopy}><Icon name="Copy" size={15} /> Copy specifications</button>
        </section>
        <div className="system-live-column">
          <section className="card" aria-labelledby="system-resources-title">
            <h2 id="system-resources-title">Resources</h2>
            <div className="system-resource-bars" aria-label="Current resource utilization">
              <div><ResourceBar label="CPU" value={resources.cpuPercent} detail={`Current utilization · ${processorDetail}`} /><Sparkline values={seriesValues("cpu")} label="CPU trend" severity={utilizationSeverity(resources.cpuPercent)} /></div>
              <div><ResourceBar label="Memory" value={memoryPercent} detail={`${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)}`} /><Sparkline values={seriesValues("memory")} label="Memory trend" severity={utilizationSeverity(memoryPercent)} /></div>
              <div><ResourceBar label="Storage" value={storagePercent} detail={`${formatBytes(resources.storageUsedBytes)} / ${formatBytes(resources.storageTotalBytes)}`} /><Sparkline values={seriesValues("storage")} label="Storage trend" severity={utilizationSeverity(storagePercent)} /></div>
            </div>
          </section>
          <div className="stat-tiles">
            <section className="card stat-tile" aria-labelledby="network-stat-title">
              <h2 id="network-stat-title"><Icon name="Network" size={16} /> Network</h2>
              <strong className="data-value">{network.ratesAvailable ? `↓ ${formatBytesPerSec(network.rxBytesPerSec)} · ↑ ${formatBytesPerSec(network.txBytesPerSec)}` : "Rates unavailable"}</strong>
              <span className="muted">{network.connected ? `${network.name} · ${network.address}` : "Offline"}</span>
              <div className="stat-tile__sparks" aria-hidden="true"><Sparkline values={seriesValues("netRx")} label="Network download trend" /><Sparkline values={seriesValues("netTx")} label="Network upload trend" /></div>
            </section>
            <section className="card stat-tile" aria-labelledby="disk-stat-title">
              <h2 id="disk-stat-title"><Icon name="HardDrive" size={16} /> Disk activity</h2>
              <strong className="data-value">{disk.available ? `Read ${formatBytesPerSec(disk.readBytesPerSec)} · Write ${formatBytesPerSec(disk.writeBytesPerSec)}` : "Activity unavailable"}</strong>
              <span className="muted">{formatPercent(storagePercent)} of {formatBytes(resources.storageTotalBytes, 0)} used</span>
              <div className="stat-tile__sparks" aria-hidden="true"><Sparkline values={seriesValues("diskRead")} label="Disk read trend" /><Sparkline values={seriesValues("diskWrite")} label="Disk write trend" /></div>
            </section>
          </div>
        </div>
      </div> : <div className="system-spec-grid">
        <section className="card system-spec-panel" aria-labelledby="device-info-title">
          <header className="card-header"><div><h2 id="device-info-title">Device specifications</h2><p className="muted">Hardware and identifiers exposed by Windows.</p></div><button type="button" className="text-action" aria-pressed={showIds} onClick={() => setShowIds(value => !value)}>{showIds ? "Hide IDs" : "Show IDs"}</button></header>
          <DetailRows rows={deviceRows} />
        </section>
        <section className="card system-spec-panel" aria-labelledby="windows-info-title">
          <header className="card-header"><div><h2 id="windows-info-title">Windows specifications</h2><p className="muted">Installed Windows edition, version, and build.</p></div></header>
          <DetailRows rows={windowsRows} />
        </section>
        <section className="card system-spec-panel system-spec-panel--wide" aria-labelledby="live-info-title">
          <header className="card-header"><div><h2 id="live-info-title">Live system status</h2><p className="muted">The same local status shown on Overview, collected in one place.</p></div></header>
          <DetailRows rows={liveRows} />
        </section>
      </div>}
      </div>
      <p className="system-privacy-note inline-caption"><Icon name="ShieldCheck" size={15} /> Read locally from Windows, the Java runtime, and the workspace drive. No administrator access is requested.</p>
    </main>
  );
}
