import { Icon, DetailRows } from '../components/ui/index.jsx';
import { formatBytes, percent, formatInstalledDate, formatPercent } from '../presentation/formatters.js';
import { ResourceBar } from '../components/instruments/ResourceBar.jsx';
export function SystemInfoView({ system, connected, configured, onCopy }) {
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
    { label: "Device ID", value: device.deviceId },
    { label: "Product ID", value: device.productId },
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

  return (
    <main className="system-info-view">
      <header className="system-info-heading">
        <div><h1>About this PC</h1><p>Device specifications, Windows information, and live resource status reported by this PC.</p></div>
        <span className={`status-label ${connected ? "status-label--good" : "status-label--warn"}`}><Icon name={connected ? "CircleCheck" : "CircleAlert"} size={14} />{connected ? "Live Windows data" : "Backend unavailable"}</span>
      </header>

      <section className="system-resource-bars" aria-label="Current resource utilization">
        <ResourceBar label="CPU" value={resources.cpuPercent} detail="Current utilization" />
        <ResourceBar label="Memory" value={memoryPercent} detail={`${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)}`} />
        <ResourceBar label="Storage" value={storagePercent} detail={`${formatBytes(resources.storageUsedBytes)} / ${formatBytes(resources.storageTotalBytes)}`} />
      </section>
      <section className="system-summary-grid" aria-label="Resource summary">
        <article><Icon name="Cpu" size={18} /><span>Processor</span><strong>{device.processorName}</strong><small>{formatPercent(resources.cpuPercent)} in use · {processorDetail}</small></article>
        <article><Icon name="MemoryStick" size={18} /><span>Installed RAM</span><strong>{formatBytes(device.installedMemoryBytes || resources.memoryTotalBytes)}</strong><small>{formatBytes(resources.memoryUsedBytes)} in use · {formatPercent(memoryPercent)}</small></article>
        <article><Icon name="Monitor" size={18} /><span>Graphics</span><strong>{graphics[0].name}</strong><small>{graphics[0].driverVersion !== "Unavailable" ? `Driver ${graphics[0].driverVersion}` : "Driver information unavailable"}</small></article>
        <article><Icon name="HardDrive" size={18} /><span>Storage</span><strong>{formatBytes(resources.storageTotalBytes, 0)}</strong><small>{formatBytes(resources.storageUsedBytes)} used · {formatPercent(storagePercent)}</small></article>
      </section>

      <section className="system-identity-bar"><div><strong>{system.host.name}</strong><span>{device.manufacturer} {device.model}</span></div><button className="secondary-button" type="button" onClick={onCopy}><Icon name="Copy" size={15} /> Copy system info</button></section>

      <div className="system-spec-grid">
        <section className="system-spec-panel" aria-labelledby="device-info-title">
          <header><span className="system-spec-icon"><Icon name="Info" size={18} /></span><div><h2 id="device-info-title">Device specifications</h2><p>Hardware and identifiers exposed by Windows.</p></div></header>
          <DetailRows rows={deviceRows} />
        </section>
        <section className="system-spec-panel" aria-labelledby="windows-info-title">
          <header><span className="system-spec-icon"><Icon name="PanelsTopLeft" size={18} /></span><div><h2 id="windows-info-title">Windows specifications</h2><p>Installed Windows edition, version, and build.</p></div></header>
          <DetailRows rows={windowsRows} />
        </section>
        <section className="system-spec-panel system-spec-panel--wide" aria-labelledby="live-info-title">
          <header><span className="system-spec-icon"><Icon name="Activity" size={18} /></span><div><h2 id="live-info-title">Live system status</h2><p>The same local status shown on the Home dashboard, collected in one place.</p></div></header>
          <DetailRows rows={liveRows} />
        </section>
      </div>
      <p className="system-privacy-note"><Icon name="ShieldCheck" size={15} /> Read locally from Windows, the Java runtime, and the workspace drive. No administrator access is requested.</p>
    </main>
  );
}
