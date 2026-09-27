import { useCallback, useEffect, useMemo, useState } from "react";
import * as FeatherIcons from "react-icons/fi";
import { getPhoneDeviceVisual } from "./phoneDevice.js";
import {
  EMPTY_MUSIC_CONNECTION,
  MUSIC_PROVIDERS,
  migrateMusicIntegration,
  normalizeMusicUrl,
} from "./musicProviders.js";
import { ACCENT_PRESETS, accentForegroundColor, accentSoftColor, effectiveAccentColor, normalizeHexColor, readAccentColor } from "./accentColors.js";

const ICON_COMPONENTS = {
  Activity: "FiActivity", AppWindow: "FiSquare", BatteryCharging: "FiBatteryCharging",
  BatteryMedium: "FiBattery", BellOff: "FiBellOff", Bluetooth: "FiBluetooth", Bookmark: "FiBookmark",
  Bot: "FiCpu", CalendarDays: "FiCalendar", Camera: "FiCamera", Check: "FiCheck",
  ChevronLeft: "FiChevronLeft", ChevronRight: "FiChevronRight", Chrome: "FiGlobe", Circle: "FiCircle",
  CircleAlert: "FiAlertCircle", CircleCheck: "FiCheckCircle", Clipboard: "FiClipboard", Cpu: "FiCpu",
  Copy: "FiCopy", ExternalLink: "FiExternalLink", Globe2: "FiGlobe", HardDrive: "FiHardDrive", House: "FiHome",
  Info: "FiInfo", Layers3: "FiLayers", Link2: "FiLink2", LoaderCircle: "FiLoader", Mail: "FiMail",
  MemoryStick: "FiServer", MessageCircle: "FiMessageCircle", MessageSquareMore: "FiMessageSquare",
  MessagesSquare: "FiMessageSquare", Mic: "FiMic", Monitor: "FiMonitor", Moon: "FiMoon",
  Music2: "FiMusic", Network: "FiWifi", PanelsTopLeft: "FiGrid", Pause: "FiPause", Play: "FiPlay",
  Plus: "FiPlus", Power: "FiPower", Presentation: "FiPieChart", RefreshCw: "FiRefreshCw", RotateCw: "FiRotateCw", Search: "FiSearch",
  Send: "FiSend", Settings: "FiSettings", Sheet: "FiGrid", Shield: "FiShield", ShieldCheck: "FiShield",
  Shuffle: "FiShuffle", SkipBack: "FiSkipBack", SkipForward: "FiSkipForward", Smartphone: "FiSmartphone",
  Sparkles: "FiZap", Sun: "FiSun", Trash2: "FiTrash2", Upload: "FiUpload", User: "FiUser", UsersRound: "FiUsers", Volume2: "FiVolume2", VolumeX: "FiVolumeX",
  Wifi: "FiWifi", X: "FiX",
};

const API_BASE = import.meta.env.VITE_API_BASE || "";

const CONTROL_META = {
  wifi: { label: "Wi-Fi", detail: "HomeNet 5G", icon: "Wifi" },
  bluetooth: { label: "Bluetooth", detail: "On", icon: "Bluetooth" },
  focus: { label: "Focus", detail: "Off", icon: "Moon" },
  "night-light": { label: "Night light", detail: "On until 7:00 AM", icon: "Sun" },
  microphone: { label: "Mic privacy", detail: "Allowed", icon: "Mic" },
  "battery-saver": { label: "Battery saver", detail: "Off", icon: "BatteryCharging" },
};

const CONTROL_ORDER = ["wifi", "bluetooth", "focus", "night-light", "microphone", "battery-saver"];

const FALLBACK_SYSTEM = {
  host: {
    name: "LOCAL-DESKTOP",
    user: "Local user",
    os: "Windows 11 Pro",
    osVersion: "24H2",
    architecture: "x64",
    javaVersion: 21,
  },
  resources: {
    cpuPercent: 12,
    memoryUsedBytes: 15.3 * 1024 ** 3,
    memoryTotalBytes: 32 * 1024 ** 3,
    storageUsedBytes: 405 * 1024 ** 3,
    storageTotalBytes: 1000 * 1024 ** 3,
    network: { name: "Ethernet", address: "Connected", connected: true },
    battery: { available: true, percent: 78, detail: "Charging" },
  },
  controls: CONTROL_ORDER.map((id) => ({
    id,
    label: CONTROL_META[id].label,
    enabled: ["wifi", "bluetooth", "night-light", "microphone"].includes(id),
    available: true,
    detail: "Opens Windows settings after approval",
  })),
  device: {
    manufacturer: "Unavailable",
    model: "Unavailable",
    processorName: "Processor information unavailable",
    processorCores: 0,
    processorLogicalProcessors: 0,
    maxClockMhz: 0,
    installedMemoryBytes: 32 * 1024 ** 3,
    graphics: [],
    systemType: "x64-based PC",
    productId: "Unavailable",
    deviceId: "Unavailable",
  },
  windows: {
    edition: "Windows",
    version: "Unavailable",
    osVersion: "Unavailable",
    build: "Unavailable",
    installedOn: "Unavailable",
    architecture: "x64",
  },
};

const FALLBACK_APPS = [
  { id: "code", name: "Visual Studio Code", detail: "Working file: app.tsx", icon: "code", running: true, age: "10m ago" },
  { id: "figma", name: "Figma", detail: "Design review", icon: "figma", running: true, age: "25m ago" },
  { id: "msedge", name: "Microsoft Edge", detail: "Live Desktop – research", icon: "edge", running: true, age: "1h ago" },
  { id: "excel", name: "Microsoft Excel", detail: "Budget_2026.xlsx", icon: "excel", running: true, age: "2h ago" },
  { id: "powerpnt", name: "PowerPoint", detail: "Q3 Planning Deck.pptx", icon: "powerpoint", running: true, age: "3h ago" },
];

const EMPTY_ICLOUD_CALENDAR = {
  connected: false,
  email: "",
  status: "disconnected",
  detail: "Connect iCloud Calendar in Settings.",
  date: "",
  events: [],
  capturedAt: null,
};

const EMPTY_MUSIC_PLAYER = {
  available: false,
  ready: false,
  playing: false,
  title: "Nothing playing",
  artist: "Music",
  album: "Start a track in your selected music player",
  artwork: "/assets/album-cover.png",
  elapsed: 0,
  duration: 0,
  shuffled: false,
  muted: false,
  detail: "Start playback once, then Live Desktop can control it through Windows.",
};

function emptyMusicPlayerFor(providerId) {
  const provider = MUSIC_PROVIDERS[providerId] || MUSIC_PROVIDERS.apple;
  return {
    ...EMPTY_MUSIC_PLAYER,
    artist: provider.name,
    album: `Start a track in ${provider.name} or its web player`,
  };
}

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "House" },
  { id: "system", label: "System Info", icon: "Monitor" },
  { id: "music", label: "Music", icon: "Music2" },
  { id: "approvals", label: "Approvals", icon: "ShieldCheck" },
  { id: "memories", label: "Memories", icon: "Bookmark" },
  { id: "conversations", label: "Conversations", icon: "MessagesSquare" },
];

const PROFILES_KEY = "live-desktop.profiles";
const ACTIVE_PROFILE_KEY = "live-desktop.active-profile";
const MUSIC_CONNECTION_KEY = "live-desktop.apple-music";
const THEME_KEY = "live-desktop.theme";
const ACCENT_COLOR_KEY = "live-desktop.accent-color";
const DEFAULT_PROFILE = { id: "default", name: "Local user", avatar: "/assets/user-avatar.png" };

function readProfiles() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROFILES_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch { /* Use the local default profile. */ }
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify([DEFAULT_PROFILE]));
  return [DEFAULT_PROFILE];
}

function activeProfileId() {
  const profiles = readProfiles();
  const saved = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
  return profiles.some((profile) => profile.id === saved) ? saved : profiles[0].id;
}

function profileStorageKey(base, profileId = activeProfileId()) {
  return `${base}.${profileId}`;
}
function formatPlaybackTime(seconds) {
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

function readMusicIntegration(profileId = activeProfileId()) {
  try {
    const scoped = window.localStorage.getItem(profileStorageKey(MUSIC_CONNECTION_KEY, profileId));
    const legacy = profileId === "default" ? window.localStorage.getItem(MUSIC_CONNECTION_KEY) : null;
    const saved = JSON.parse(scoped || legacy);
    return migrateMusicIntegration(saved);
  } catch {
    return migrateMusicIntegration(null);
  }
}

const APP_ICON_ASSETS = {
  code: "/assets/app-vscode.svg",
  figma: "/assets/app-figma.svg",
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-Profile-Id": activeProfileId(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForRestartReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/api/runtime?restart=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        const status = await response.json();
        if (status.backendOnline && status.frontendOnline) return true;
      }
    } catch {
      // Both services are expected to disappear briefly during a restart.
    }
    await delay(1000);
  }
  return false;
}

function Icon({ name, size = 20, strokeWidth = 1.8, className = "" }) {
  const Component = FeatherIcons[ICON_COMPONENTS[name]] || FeatherIcons.FiCircle;
  return <span className={`icon ${className}`} aria-hidden="true"><Component size={size} strokeWidth={strokeWidth} /></span>;
}

function AppLogo({ small = false }) {
  return (
    <span className={`app-logo ${small ? "app-logo--small" : ""}`} aria-hidden="true">
      <Icon name="Sparkles" size={small ? 18 : 22} strokeWidth={2.2} />
    </span>
  );
}

function Toggle({ enabled, pending, disabled, onClick, label }) {
  return (
    <button
      className={`toggle ${enabled ? "toggle--on" : ""}`}
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${label}: ${enabled ? "on" : "off"}. Open Windows setting`}
      disabled={disabled || pending}
      onClick={onClick}
    >
      <span className="toggle__thumb">{pending ? <Icon name="LoaderCircle" size={11} className="spin" /> : null}</span>
    </button>
  );
}

function formatBytes(value, digits = 1) {
  if (!Number.isFinite(value) || value <= 0) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? digits : 0)} ${units[index]}`;
}

function percent(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function formatRelativeTime(value) {
  if (!value) return "Not available";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not available";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function localDateAtOffset(dayOffset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventTime(event) {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function eventDuration(event) {
  if (event.allDay) return "All day";
  const minutes = Math.max(0, Math.round((new Date(event.end) - new Date(event.start)) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function MeterSparkline({ value = 40 }) {
  return <meter className="resource-meter" min="0" max="100" value={Math.max(0, Math.min(100, value))}>{value}%</meter>;
}

function BrandIcon({ app }) {
  if (APP_ICON_ASSETS[app.icon]) {
    return <img className="brand-icon" src={APP_ICON_ASSETS[app.icon]} alt="" />;
  }
  const names = {
    edge: "Globe2",
    chrome: "Chrome",
    excel: "Sheet",
    powerpoint: "Presentation",
    "apple-music": "Music2",
    slack: "MessageSquareMore",
    teams: "UsersRound",
  };
  return (
    <span className={`brand-icon brand-icon--${app.icon || app.id}`}>
      <Icon name={names[app.icon] || "AppWindow"} size={20} />
    </span>
  );
}

function SystemHealth({ system, connected, configured, onOpenSystem }) {
  const resources = system.resources;
  const memoryPercent = percent(resources.memoryUsedBytes, resources.memoryTotalBytes);
  const storagePercent = percent(resources.storageUsedBytes, resources.storageTotalBytes);
  const rows = [
    {
      icon: "Cpu",
      label: "CPU",
      main: `${resources.cpuPercent ?? 0}%`,
      detail: system.host.architecture,
      value: resources.cpuPercent,
      spark: true,
    },
    {
      icon: "MemoryStick",
      label: "Memory",
      main: `${memoryPercent}%`,
      detail: `${formatBytes(resources.memoryUsedBytes)} / ${formatBytes(resources.memoryTotalBytes)}`,
      value: memoryPercent,
      spark: true,
    },
    {
      icon: "HardDrive",
      label: "Storage",
      main: `${storagePercent}%`,
      detail: `${formatBytes(Math.max(0, resources.storageTotalBytes - resources.storageUsedBytes))} free`,
      value: storagePercent,
      spark: true,
    },
    {
      icon: "Wifi",
      label: "Network",
      main: resources.network.connected ? "Online" : "Offline",
      detail: resources.network.name,
      value: resources.network.connected ? 62 : 0,
      spark: true,
    },
    {
      icon: "BatteryMedium",
      label: "Battery",
      main: resources.battery.available ? `${resources.battery.percent}%` : "AC power",
      detail: resources.battery.detail,
      value: resources.battery.percent || 100,
      spark: resources.battery.available,
    },
  ];

  return (
    <section className="health-column" aria-labelledby="health-title">
      <div className="column-title-row">
        <h3 id="health-title">System health</h3>
        <span className={`status-label ${connected ? "status-label--good" : "status-label--warn"}`}>
          <Icon name={connected ? "CircleCheck" : "CircleAlert"} size={14} />
          {connected ? "All good" : "Offline preview"}
        </span>
      </div>
      <div className="metric-list">
        {rows.map((row) => (
          <div className="metric-row" key={row.label}>
            <Icon name={row.icon} size={21} className="metric-icon" />
            <div className="metric-copy">
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <b>{row.main}</b>
            {row.spark ? <MeterSparkline value={row.value} /> : <span className="metric-space" />}
          </div>
        ))}
      </div>
      <div className="device-list">
        <InfoLine icon="PanelsTopLeft" label="Windows" value={`${system.host.os} ${system.host.osVersion}`} />
        <InfoLine icon="Monitor" label="Device" value={system.host.name} />
        <InfoLine icon="Layers3" label="Backend" value={connected ? "Local API connected" : "Unavailable"} healthy={connected} />
        <InfoLine icon="Bot" label="OpenAI" value={configured ? "Connected" : "API key needed"} healthy={configured} />
      </div>
      <button className="text-action" type="button" onClick={onOpenSystem}>
        System details <Icon name="ChevronRight" size={15} />
      </button>
    </section>
  );
}

function InfoLine({ icon, label, value, healthy }) {
  return (
    <div className="info-line">
      <Icon name={icon} size={19} />
      <strong>{label}</strong>
      <span title={value}>{value}</span>
      {healthy !== undefined ? <i className={`status-dot ${healthy ? "status-dot--good" : "status-dot--warn"}`} /> : null}
    </div>
  );
}

function RecentApps({ apps }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const displayApps = apps.length ? apps.map((app, index) => ({ ...app, age: index ? `${index * 12 + 1}m ago` : "Now" })) : FALLBACK_APPS;
  const visibleApps = showAll ? displayApps : displayApps.slice(0, 4);
  return (
    <section className="activity-column" aria-labelledby="activity-title">
      <div className="column-title-row">
        <h3 id="activity-title">Recent activity</h3>
        <button type="button" className="text-action" onClick={() => setShowAll((value) => !value)}>{showAll ? "Compact" : "View all"}</button>
      </div>
      <div className="app-list">
        {visibleApps.map((app) => (
          <div className={`app-row-wrap ${selectedId === app.id ? "app-row-wrap--selected" : ""}`} key={app.id}>
            <button className="app-row" type="button" aria-expanded={selectedId === app.id} onClick={() => setSelectedId((value) => value === app.id ? null : app.id)}>
              <BrandIcon app={app} />
              <span>
                <strong>{app.name}</strong>
                <small>{app.detail}</small>
              </span>
              <time>{app.age}</time>
            </button>
            {selectedId === app.id ? <p className="app-inline-detail"><Icon name="Activity" size={14} /> Detected from the live Windows process list.</p> : null}
          </div>
        ))}
      </div>
      <button className="text-action show-more" type="button" onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show less" : "Show more"} <Icon name={showAll ? "ChevronLeft" : "ChevronRight"} size={15} />
      </button>
    </section>
  );
}

function CalendarAndMedia({ calendar, calendarRefreshing, musicProvider, musicPlayer, musicConfigured, onCalendarDateChange, onRefreshCalendar, onOpenCalendarSettings, onOpenMusic, onMusicAction }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [dayOpen, setDayOpen] = useState(false);
  const calendarDate = localDateAtOffset(dayOffset);
  const dateKey = localIsoDate(calendarDate);
  const dateLabel = calendarDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const events = calendar.date === dateKey ? calendar.events || [] : [];

  useEffect(() => {
    onCalendarDateChange(dateKey);
  }, [dateKey]);
  return (
    <section className="calendar-column" aria-labelledby="calendar-title">
      <div className="column-title-row">
        <div>
          <h3 id="calendar-title">iCloud Calendar</h3>
          <p>{dateLabel}{calendar.connected ? ` · ${calendar.detail}` : ""}</p>
        </div>
        <div className="calendar-nav">
          <button type="button" aria-label="Previous day" onClick={() => setDayOffset((value) => value - 1)}><Icon name="ChevronLeft" size={18} /></button>
          <button type="button" onClick={() => setDayOffset(0)}>Today</button>
          <button type="button" aria-label="Next day" onClick={() => setDayOffset((value) => value + 1)}><Icon name="ChevronRight" size={18} /></button>
          <button type="button" aria-label="Refresh iCloud Calendar" onClick={() => onRefreshCalendar(dateKey)} disabled={calendarRefreshing || !calendar.connected}><Icon name="RefreshCw" size={15} className={calendarRefreshing ? "spin" : ""} /></button>
        </div>
      </div>
      <div className="agenda">
        {!calendar.connected ? <button className="calendar-connect" type="button" onClick={onOpenCalendarSettings}><Icon name="CalendarDays" size={20} /><span><strong>Connect iCloud Calendar</strong><small>Show your real events in this dashboard.</small></span><Icon name="ChevronRight" size={16} /></button> : null}
        {calendar.connected && calendar.status === "error" ? <div className="agenda-empty agenda-empty--error"><Icon name="CircleAlert" size={18} /> {calendar.detail}</div> : null}
        {calendar.connected && calendar.status !== "error" && calendarRefreshing && calendar.date !== dateKey ? <div className="agenda-empty"><Icon name="LoaderCircle" size={18} className="spin" /> Syncing iCloud events…</div> : null}
        {calendar.connected && calendar.status !== "error" && !calendarRefreshing && events.length === 0 ? <div className="agenda-empty"><Icon name="CalendarDays" size={18} /> No iCloud events for this day.</div> : null}
        {events.map((event) => <AgendaItem key={event.id} time={eventTime(event)} title={event.title} detail={event.location || event.calendar || "iCloud"} duration={eventDuration(event)} active={new Date(event.start) <= new Date() && new Date(event.end) >= new Date()} />)}
      </div>
      <button className="text-action" type="button" aria-expanded={dayOpen} onClick={() => setDayOpen((value) => !value)}>
        {dayOpen ? "Close day view" : "Open day view"} <Icon name="ChevronRight" size={14} />
      </button>
      {dayOpen ? <div className="calendar-inline"><strong>{dateLabel}</strong><span>{calendar.connected ? `${events.length} iCloud event${events.length === 1 ? "" : "s"} · Synced ${formatRelativeTime(calendar.capturedAt)}` : "Connect your account in Settings to sync events."}</span></div> : null}
      <div className="media-widget">
        <div className="media-label">
          <span><img src={musicProvider.icon} alt="" /> {musicProvider.name} {musicPlayer.ready ? "· live" : ""}</span>
          <button type="button" onClick={onOpenMusic}>{musicConfigured ? "Open player" : "Connect"}<Icon name="ChevronRight" size={13} /></button>
        </div>
        <div className="track">
          <img src={musicPlayer.artwork} alt={`Current ${musicProvider.name} artwork`} />
          <div><strong>{musicPlayer.title}</strong><span>{musicPlayer.artist}</span><small>{musicPlayer.album}</small></div>
        </div>
        <div className="progress" aria-label="Playback progress"><i style={{ width: `${musicPlayer.duration ? Math.min(100, (musicPlayer.elapsed / musicPlayer.duration) * 100) : 0}%` }} /></div>
        <div className="track-time"><span>{formatPlaybackTime(musicPlayer.elapsed)}</span><span>{formatPlaybackTime(musicPlayer.duration)}</span></div>
        <div className="media-controls">
          <button className={musicPlayer.shuffled ? "active" : ""} type="button" aria-label="Toggle shuffle" onClick={() => onMusicAction("shuffle")}><Icon name="Shuffle" size={16} /></button>
          <button type="button" aria-label="Previous track" onClick={() => onMusicAction("previous")}><Icon name="SkipBack" size={19} /></button>
          <button className="play-button" type="button" aria-label={musicPlayer.playing ? "Pause" : "Play"} onClick={() => onMusicAction(musicPlayer.playing ? "pause" : "play")}><Icon name={musicPlayer.playing ? "Pause" : "Play"} size={19} /></button>
          <button type="button" aria-label="Next track" onClick={() => onMusicAction("next")}><Icon name="SkipForward" size={19} /></button>
          <button className={musicPlayer.muted ? "active" : ""} type="button" aria-label="Toggle mute" onClick={() => onMusicAction("mute")}><Icon name={musicPlayer.muted ? "VolumeX" : "Volume2"} size={17} /></button>
        </div>
      </div>
    </section>
  );
}

function AgendaItem({ time, title, detail, duration, active }) {
  return (
    <div className="agenda-item">
      <time>{time}</time>
      <i className={active ? "agenda-dot agenda-dot--active" : "agenda-dot"} />
      <div><strong>{title}</strong><span>{detail}</span></div>
      <small>{duration}</small>
    </div>
  );
}

function PhonePanel({ phone, onOpen, onRefresh, onCopy, busy, refreshing }) {
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
      <div className="phone-section-title"><strong>Phone Link status</strong><span>Checked {formatRelativeTime(phone?.capturedAt)}</span></div>
      <div className="notification-list">
        {phone?.notificationsAvailable ? (
          <Notification icon="MessageCircle" color="green" label="Notifications available" detail="Open Phone Link only when you want to read private content." time={lastSync} />
        ) : (
          <div className="phone-empty">
            <Icon name="BellOff" size={22} />
            <span>No new notification signal is available.</span>
          </div>
        )}
      </div>
      <div className="phone-actions">
        <strong>Quick actions</strong>
        <div>
          <PhoneAction icon="RefreshCw" label="Refresh" onClick={onRefresh} disabled={refreshing} />
          <PhoneAction icon="Copy" label="Copy device" onClick={onCopy} disabled={!ready} />
          <PhoneAction icon="Info" label="Details" onClick={() => setDetailsOpen((value) => !value)} disabled={!ready} active={detailsOpen} />
          <PhoneAction icon="ExternalLink" label="Open app" onClick={onOpen} disabled={!ready || busy} />
        </div>
      </div>
      {detailsOpen ? (
        <div className="phone-details">
          <InfoLine icon="Smartphone" label="Device" value={phone.deviceName || "Linked phone"} />
          <InfoLine icon="Layers3" label="System" value={[phone.osName, phone.model].filter((value) => value && value !== "Unknown").join(" · ") || "Unknown"} />
          <InfoLine icon="Activity" label="Last seen" value={formatRelativeTime(phone.lastSeenAt)} />
        </div>
      ) : null}
      <button className="text-action phone-settings" type="button" onClick={onOpen} disabled={!ready || busy}>
        Open Phone Link externally <Icon name="ExternalLink" size={14} />
      </button>
    </aside>
  );
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

function PhoneAction({ icon, label, onClick, disabled, active = false }) {
  return <button className={active ? "active" : ""} type="button" onClick={onClick} disabled={disabled}><Icon name={icon} size={18} /><span>{label}</span></button>;
}

function AssistantBar({ onSubmit, busy }) {
  const [value, setValue] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const message = value.trim();
    if (!message || busy) return;
    onSubmit(message);
    setValue("");
  };
  return (
    <form className="assistant-bar" onSubmit={submit}>
      <AppLogo small />
      <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ask your assistant anything..." aria-label="Ask your assistant" />
      <button type="button" className="voice-button" aria-label="Voice input"><Icon name="Mic" size={21} /></button>
      <button type="submit" className="send-button" aria-label="Send" disabled={busy || !value.trim()}>
        <Icon name={busy ? "LoaderCircle" : "Send"} size={24} className={busy ? "spin" : ""} />
      </button>
    </form>
  );
}

function EmptyState({ icon, title, detail }) {
  return <div className="empty-state"><Icon name={icon} size={28} /><h3>{title}</h3><p>{detail}</p></div>;
}

function ApprovalsView({ actions, loading, onApprove, onReject }) {
  return (
    <ViewShell eyebrow="Safety center" title="Approvals" detail="Review every change before it reaches your files, browser, or Windows settings.">
      <div className="view-toolbar"><span>{actions.filter((action) => action.status === "pending").length} pending</span></div>
      {loading ? <EmptyState icon="LoaderCircle" title="Loading approvals" detail="Checking the local action queue." /> : null}
      {!loading && !actions.length ? <EmptyState icon="ShieldCheck" title="Nothing needs review" detail="New assistant and system actions will appear here." /> : null}
      <div className="approval-list">
        {actions.map((action) => (
          <article className="approval-row" key={action.id}>
            <span className={`approval-kind approval-kind--${action.status}`}><Icon name={action.kind === "windows_open_uri" ? "Settings" : "Shield"} size={19} /></span>
            <div><strong>{action.reason}</strong><span>{action.kind.replaceAll("_", " ")} · {new Date(action.createdAt).toLocaleString()}</span></div>
            <span className={`state-pill state-pill--${action.status}`}>{action.status}</span>
            {action.status === "pending" ? <div className="row-actions"><button onClick={() => onReject(action.id)} type="button">Reject</button><button className="primary-button" onClick={() => onApprove(action.id)} type="button">Approve</button></div> : null}
          </article>
        ))}
      </div>
    </ViewShell>
  );
}

function MemoriesView({ memories, onCreate, onDelete }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("preference");
  const submit = (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    onCreate(content.trim(), category).then(() => setContent(""));
  };
  return (
    <ViewShell eyebrow="Local memory" title="Memories" detail="Everything remembered is stored locally and stays inspectable and removable.">
      <form className="memory-form" onSubmit={submit}>
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Remember a preference or project detail" aria-label="Memory content" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Memory category">
          <option value="preference">Preference</option><option value="project">Project</option><option value="fact">Fact</option><option value="instruction">Instruction</option>
        </select>
        <button className="primary-button" type="submit"><Icon name="Plus" size={17} /> Add memory</button>
      </form>
      {!memories.length ? <EmptyState icon="Bookmark" title="No memories yet" detail="Add one above or approve a memory suggested by the assistant." /> : null}
      <div className="memory-grid">
        {memories.map((memory) => <article className="memory-item" key={memory.id}><span>{memory.category}</span><p>{memory.content}</p><button type="button" onClick={() => onDelete(memory.id)} aria-label="Delete memory"><Icon name="Trash2" size={17} /></button></article>)}
      </div>
    </ViewShell>
  );
}

function ConversationsView({ conversations, selected, onSelect, onSend, busy }) {
  const [value, setValue] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSend(value.trim(), selected?.id);
    setValue("");
  };
  return (
    <ViewShell eyebrow="Local assistant" title="Conversations" detail="Continue a thread or start a new one with the same private local history.">
      <div className="conversation-layout">
        <aside className="conversation-list">
          <button className="new-chat" type="button" onClick={() => onSelect(null)}><Icon name="Plus" size={17} /> New conversation</button>
          {conversations.map((conversation) => <button className={selected?.id === conversation.id ? "selected" : ""} type="button" key={conversation.id} onClick={() => onSelect(conversation)}><strong>{conversation.title}</strong><span>{conversation.messageCount} messages</span></button>)}
        </aside>
        <section className="chat-panel">
          <div className="messages">
            {selected?.messages?.length ? selected.messages.map((message) => <div className={`message message--${message.role}`} key={message.id}><span>{message.role === "user" ? "You" : "Live Desktop"}</span><p>{message.content}</p></div>) : <EmptyState icon="MessageCircle" title="Start a conversation" detail="Ask about your files, system, or current work." />}
          </div>
          <form className="chat-compose" onSubmit={submit}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Message your assistant" /><button className="primary-button" type="submit" disabled={busy}><Icon name={busy ? "LoaderCircle" : "Send"} size={17} className={busy ? "spin" : ""} /> Send</button></form>
        </section>
      </div>
    </ViewShell>
  );
}

function ViewShell({ eyebrow, title, detail, children }) {
  return <main className="view-shell"><header><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></header>{children}</main>;
}

function formatInstalledDate(value) {
  if (!value || value === "Unavailable") return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function DetailRows({ rows }) {
  return (
    <dl className="system-detail-list">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd title={String(row.value)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SystemInfoView({ system, connected, configured, onCopy }) {
  const resources = system.resources;
  const device = system.device || FALLBACK_SYSTEM.device;
  const windows = system.windows || FALLBACK_SYSTEM.windows;
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
    { label: "OpenAI", value: configured ? "Connected" : "API key needed" },
    { label: "Java runtime", value: `Java ${system.host.javaVersion}` },
    { label: "Last refreshed", value: system.capturedAt ? new Date(system.capturedAt).toLocaleString() : "Preview data" },
  ];

  return (
    <main className="system-info-view">
      <header className="system-info-heading">
        <div><span>System</span><h1>About this PC</h1><p>Device specifications, Windows information, and live resource status reported by this PC.</p></div>
        <span className={`status-label ${connected ? "status-label--good" : "status-label--warn"}`}><Icon name={connected ? "CircleCheck" : "CircleAlert"} size={14} />{connected ? "Live Windows data" : "Offline preview"}</span>
      </header>

      <section className="system-summary-grid" aria-label="Resource summary">
        <article><Icon name="Cpu" size={18} /><span>Processor</span><strong>{device.processorName}</strong><small>{resources.cpuPercent}% in use · {processorDetail}</small></article>
        <article><Icon name="MemoryStick" size={18} /><span>Installed RAM</span><strong>{formatBytes(device.installedMemoryBytes || resources.memoryTotalBytes)}</strong><small>{formatBytes(resources.memoryUsedBytes)} in use · {memoryPercent}%</small></article>
        <article><Icon name="Monitor" size={18} /><span>Graphics</span><strong>{graphics[0].name}</strong><small>{graphics[0].driverVersion !== "Unavailable" ? `Driver ${graphics[0].driverVersion}` : "Driver information unavailable"}</small></article>
        <article><Icon name="HardDrive" size={18} /><span>Storage</span><strong>{formatBytes(resources.storageTotalBytes, 0)}</strong><small>{formatBytes(resources.storageUsedBytes)} used · {storagePercent}%</small></article>
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

function ShutdownDialog({ onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="lifecycle-dialog" role="dialog" aria-modal="true" aria-labelledby="shutdown-title">
        <span className="dialog-icon dialog-icon--danger"><Icon name="Power" size={22} /></span>
        <div>
          <span className="dialog-eyebrow">Local services</span>
          <h2 id="shutdown-title">Shut down Live Desktop?</h2>
          <p>This stops both the frontend and backend. The current page will remain visible, but it cannot start the services again after they are off.</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button className="danger-button" type="button" onClick={onConfirm}><Icon name="Power" size={16} /> Shut down both</button>
        </div>
      </section>
    </div>
  );
}

function LifecycleNotice({ state }) {
  if (state === "idle") return null;
  const restarting = state === "restarting";
  return (
    <div className={`lifecycle-notice lifecycle-notice--${state}`} role="status">
      <span className="dialog-icon"><Icon name={restarting ? "RotateCw" : "Power"} size={22} className={restarting ? "spin" : ""} /></span>
      <div>
        <strong>{restarting ? "Restarting Live Desktop" : "Live Desktop services are off"}</strong>
        <span>{restarting ? "The dashboard will reconnect and reload automatically." : "Run the project launch scripts when you want to come back online."}</span>
      </div>
    </div>
  );
}

function ProfilePicker({ profiles, activeProfile, onProfilesChange, onSwitch, onDelete }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(activeProfile.name);
  const fileId = `profile-image-${activeProfile.id}`;

  useEffect(() => setName(activeProfile.name), [activeProfile.id, activeProfile.name]);

  const updateActive = (changes) => {
    const next = profiles.map((profile) => profile.id === activeProfile.id ? { ...profile, ...changes } : profile);
    onProfilesChange(next);
  };

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => updateActive({ avatar: reader.result });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const createProfile = () => {
    const id = crypto.randomUUID().replaceAll("-", "_");
    const next = { id, name: `Profile ${profiles.length + 1}`, avatar: "/assets/user-avatar.png" };
    onProfilesChange([...profiles, next]);
    onSwitch(id);
  };

  return (
    <div className="profile-picker">
      <button className="profile-trigger" type="button" aria-label={`Open profile picker for ${activeProfile.name}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <img src={activeProfile.avatar} alt="" /><span><strong>{activeProfile.name}</strong><small>Local profile</small></span><Icon name="ChevronRight" size={14} />
      </button>
      {open ? (
        <section className="profile-menu" aria-label="Local profiles">
          <div className="profile-menu__heading"><div><strong>Profiles</strong><span>Everything stays on this PC</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close profiles"><Icon name="X" size={16} /></button></div>
          <div className="profile-list">
            {profiles.map((profile) => <button className={profile.id === activeProfile.id ? "active" : ""} type="button" key={profile.id} onClick={() => profile.id !== activeProfile.id && onSwitch(profile.id)}><img src={profile.avatar} alt="" /><span><strong>{profile.name}</strong><small>{profile.id === activeProfile.id ? "Current profile" : "Switch profile"}</small></span>{profile.id === activeProfile.id ? <Icon name="Check" size={16} /> : null}</button>)}
          </div>
          <div className="profile-editor">
            <label htmlFor="profile-name">Profile name</label>
            <div><input id="profile-name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() && updateActive({ name: name.trim() })} /><label className="avatar-upload" htmlFor={fileId}><Icon name="Upload" size={15} /> Change photo</label><input className="visually-hidden" id={fileId} type="file" accept="image/*" onChange={uploadAvatar} /></div>
          </div>
          <div className="profile-menu__actions"><button className="secondary-button" type="button" onClick={createProfile}><Icon name="Plus" size={15} /> New profile</button><button className="text-action text-action--danger" type="button" disabled={activeProfile.id === "default" || profiles.length === 1} onClick={() => onDelete(activeProfile.id)}><Icon name="Trash2" size={14} /> Delete</button></div>
        </section>
      ) : null}
    </div>
  );
}

function SettingsView({ darkMode, onDarkModeChange, accentColor, onAccentColorChange, onCustomAccentColorChange, calendar, onConnectCalendar, onDisconnectCalendar, musicProviderId, musicConnection, musicPlayer, onMusicProviderChange, onSaveMusic, onDisconnectMusic, onRefreshMusic, onOpenMusic, openAiSettings, onSaveOpenAiKey, onDeleteOpenAiKey }) {
  const musicProvider = MUSIC_PROVIDERS[musicProviderId];
  const [musicUrl, setMusicUrl] = useState(musicConnection.sourceUrl || "");
  const [error, setError] = useState("");
  const [calendarEmail, setCalendarEmail] = useState(calendar.email || "");
  const [calendarPassword, setCalendarPassword] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiBusy, setOpenAiBusy] = useState(false);
  const [openAiError, setOpenAiError] = useState("");
  const [customAccent, setCustomAccent] = useState(accentColor);
  const [accentError, setAccentError] = useState("");

  useEffect(() => {
    setMusicUrl(musicConnection.sourceUrl || "");
    setError("");
  }, [musicConnection.sourceUrl, musicProviderId]);

  useEffect(() => {
    setCustomAccent(accentColor);
    setAccentError("");
  }, [accentColor]);

  const saveMusic = (event) => {
    event.preventDefault();
    try {
      const embedUrl = normalizeMusicUrl(musicProviderId, musicUrl);
      onSaveMusic({ sourceUrl: musicUrl.trim(), embedUrl });
      setError("");
    } catch (urlError) {
      setError(urlError.message);
    }
  };

  const connectCalendar = async (event) => {
    event.preventDefault();
    setCalendarBusy(true);
    setCalendarError("");
    try {
      await onConnectCalendar(calendarEmail, calendarPassword);
      setCalendarPassword("");
    } catch (connectionError) {
      setCalendarError(connectionError.message);
    } finally {
      setCalendarBusy(false);
    }
  };

  return (
    <main className="view-shell settings-view">
      <header><span>Preferences</span><h1>Settings</h1><p>Connect services and choose how Live Desktop looks. Preferences and credentials stay local to this PC.</p></header>
      <div className="settings-grid">
        <section className="settings-card settings-card--credentials" aria-labelledby="openai-key-title">
          <div className="settings-card__icon"><Icon name="Bot" size={20} /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="openai-key-title">OpenAI API key</h2><p>This key belongs only to the current local profile and is protected with Windows data protection.</p></div><span className={`connection-pill ${openAiSettings.openAiConfigured ? "connection-pill--on" : ""}`}>{openAiSettings.openAiConfigured ? "Connected" : "Not connected"}</span></div>
            <form className="profile-key-form" onSubmit={async (event) => { event.preventDefault(); setOpenAiBusy(true); setOpenAiError(""); try { await onSaveOpenAiKey(openAiKey); setOpenAiKey(""); } catch (keyError) { setOpenAiError(keyError.message); } finally { setOpenAiBusy(false); } }}>
              <label htmlFor="openai-api-key">API key</label><div><input id="openai-api-key" type="password" value={openAiKey} onChange={(event) => setOpenAiKey(event.target.value)} autoComplete="off" placeholder={openAiSettings.profileApiKey ? "Profile key saved" : "sk-..."} required /><button className="primary-button" type="submit" disabled={openAiBusy}>{openAiBusy ? "Saving…" : openAiSettings.profileApiKey ? "Replace key" : "Save key"}</button>{openAiSettings.profileApiKey ? <button className="secondary-button" type="button" onClick={onDeleteOpenAiKey}>Remove</button> : null}</div>
              <small>The key is never returned to the browser after saving.</small>{openAiError ? <p className="form-error" role="alert">{openAiError}</p> : null}
            </form>
          </div>
        </section>
        <section className="settings-card settings-card--appearance" aria-labelledby="appearance-title">
          <div className="settings-card__icon"><Icon name={darkMode ? "Moon" : "Sun"} size={20} /></div>
          <div className="settings-card__content">
            <h2 id="appearance-title">Appearance</h2>
            <p>Dark mode uses the completely black background selected for this dashboard.</p>
            <fieldset className="accent-settings">
              <legend>Accent color</legend>
              <div className="accent-presets">
                {ACCENT_PRESETS.map((preset) => (
                  <button className={accentColor === preset.color ? "active" : ""} data-color={preset.id} key={preset.id} type="button" aria-label={`Use ${preset.label} accent`} aria-pressed={accentColor === preset.color} onClick={() => onAccentColorChange(preset.color)}>
                    <span style={{ backgroundColor: effectiveAccentColor(preset.color, darkMode) }} />{preset.label}{accentColor === preset.color ? <Icon name="Check" size={14} /> : null}
                  </button>
                ))}
              </div>
              <form className="custom-accent-form" onSubmit={(event) => { event.preventDefault(); try { const normalized = onCustomAccentColorChange(customAccent); setCustomAccent(normalized); setAccentError(""); } catch (colorError) { setAccentError(colorError.message); } }}>
                <label htmlFor="custom-accent-color">Custom hex color</label>
                <div><span className="custom-accent-preview" style={{ backgroundColor: effectiveAccentColor(/^#[0-9a-f]{6}$/i.test(customAccent) ? customAccent : accentColor, darkMode) }} /><input id="custom-accent-color" value={customAccent} onChange={(event) => { setCustomAccent(event.target.value); setAccentError(""); }} placeholder="#1685FF" spellCheck="false" autoComplete="off" /><button className="secondary-button" type="submit">Apply</button></div>
                {accentError ? <p className="form-error" role="alert">{accentError}</p> : <small>Enter a 3- or 6-digit hex code.</small>}
              </form>
            </fieldset>
          </div>
          <button className={`toggle settings-toggle ${darkMode ? "toggle--on" : ""}`} type="button" role="switch" aria-checked={darkMode} aria-label="Dark mode" onClick={() => onDarkModeChange(!darkMode)}><span className="toggle__thumb" /></button>
        </section>

        <section className="settings-card settings-card--calendar" aria-labelledby="icloud-calendar-title">
          <div className="settings-card__icon settings-card__icon--icloud"><Icon name="CalendarDays" size={21} /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="icloud-calendar-title">iCloud Calendar</h2><p>Sync your Apple calendars into the dashboard’s existing day view.</p></div><span className={`connection-pill ${calendar.connected ? "connection-pill--on" : ""}`}>{calendar.connected ? "Connected" : "Not connected"}</span></div>
            {calendar.connected ? (
              <div className="connected-account-row"><div><strong>{calendar.email}</strong><span>{calendar.detail} · Last refreshed {formatRelativeTime(calendar.capturedAt)}</span></div><button className="secondary-button" type="button" onClick={onDisconnectCalendar}>Disconnect</button></div>
            ) : (
              <form className="icloud-connect-form" onSubmit={connectCalendar}>
                <label htmlFor="icloud-email">Apple Account email</label>
                <input id="icloud-email" type="email" value={calendarEmail} onChange={(event) => { setCalendarEmail(event.target.value); setCalendarError(""); }} autoComplete="username" placeholder="you@icloud.com" required />
                <label htmlFor="icloud-app-password">App-specific password</label>
                <input id="icloud-app-password" type="password" value={calendarPassword} onChange={(event) => { setCalendarPassword(event.target.value); setCalendarError(""); }} autoComplete="new-password" placeholder="xxxx-xxxx-xxxx-xxxx" required />
                <div className="icloud-form-actions"><button className="primary-button" type="submit" disabled={calendarBusy}>{calendarBusy ? "Connecting…" : "Connect iCloud Calendar"}</button><a href="https://account.apple.com/account/manage" target="_blank" rel="noreferrer">Create an app-specific password <Icon name="ExternalLink" size={13} /></a></div>
                <small>Use an app-specific password from Apple—never enter your regular Apple Account password. It is encrypted with Windows data protection and stays on this PC.</small>
                {calendarError ? <p className="form-error" role="alert">{calendarError}</p> : null}
              </form>
            )}
          </div>
        </section>

        <section className="settings-card settings-card--music" aria-labelledby="music-account-title">
          <div className={`settings-card__icon settings-card__icon--music settings-card__icon--${musicProviderId}`}><img src={musicProvider.icon} alt="" /></div>
          <div className="settings-card__content">
            <div className="settings-title-row"><div><h2 id="music-account-title">Music service</h2><p>Choose which web player powers the existing dashboard widget and full Music view.</p></div><span className="connection-pill connection-pill--on">No extra fee</span></div>

            <div className="music-provider-picker" role="radiogroup" aria-label="Music service">
              {Object.values(MUSIC_PROVIDERS).map((provider) => (
                <button key={provider.id} className={provider.id === musicProviderId ? "active" : ""} type="button" role="radio" aria-checked={provider.id === musicProviderId} onClick={() => onMusicProviderChange(provider.id)}>
                  <img src={provider.icon} alt="" /><span><strong>{provider.name}</strong><small>{provider.id === musicProviderId ? "Used by widgets" : "Switch service"}</small></span>{provider.id === musicProviderId ? <Icon name="Check" size={16} /> : null}
                </button>
              ))}
            </div>

            <div className="music-auth-row">
              <div><strong>Local Windows media session</strong><span>{musicPlayer.available ? `${musicPlayer.title} · ${musicPlayer.detail}` : musicPlayer.detail}</span></div>
              <button type="button" className="secondary-button" onClick={onRefreshMusic}><Icon name="RefreshCw" size={15} /> Refresh status</button>
            </div>

            <div className="free-integration-note"><Icon name="CircleCheck" size={18} /><div><strong>No developer credentials required</strong><span>Sign in only inside {musicProvider.name}’s player. Live Desktop reads the active song and sends playback commands locally through Windows.</span></div></div>

            <form className="music-link-form" onSubmit={saveMusic}>
              <label htmlFor="music-service-url">{musicProvider.linkLabel}</label>
              <div><input id="music-service-url" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder={musicProvider.placeholder} required /><button className="primary-button" type="submit">Connect link</button></div>
              <small>In {musicProvider.name}, choose Share, copy the link, and paste it here. Open the full player and start a track once; the dashboard controls will then follow that Windows media session.</small>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
            </form>

            <div className="connected-actions"><button className="primary-button" type="button" onClick={onOpenMusic}><Icon name="Music2" size={16} /> Open full player</button><a className="secondary-button" href={musicProvider.externalUrl} target="_blank" rel="noreferrer"><Icon name="ExternalLink" size={15} /> Open {musicProvider.name} externally</a>{musicConnection.embedUrl ? <button className="text-action text-action--danger" type="button" onClick={onDisconnectMusic}>Disconnect {musicProvider.contentLabel}</button> : null}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MusicView({ musicProvider, musicConnection, musicPlayer, onMusicAction, onOpenSettings }) {
  return (
    <main className="music-view">
      <header>
        <div><span>{musicProvider.name}</span><h1>Your music</h1><p>{musicProvider.playerDescription}</p></div>
        <button className="secondary-button" type="button" onClick={onOpenSettings}><Icon name="Settings" size={16} /> Music settings</button>
      </header>
      <section className="music-stage">
        <div className="music-stage__art"><img src={musicPlayer.artwork} alt={`Current ${musicProvider.name} artwork`} /></div>
        <div className="music-stage__player">
          <div className="music-stage__source"><img src={musicProvider.icon} alt="" /><span>{musicPlayer.available ? "Windows media session connected" : "Start a track in the player below"}</span></div>
          <h2>{musicPlayer.title}</h2><p>{musicPlayer.artist}</p><small>{musicPlayer.album}</small>
          <div className="progress music-stage__progress"><i style={{ width: `${musicPlayer.duration ? Math.min(100, (musicPlayer.elapsed / musicPlayer.duration) * 100) : 0}%` }} /></div>
          <div className="track-time"><span>{formatPlaybackTime(musicPlayer.elapsed)}</span><span>{formatPlaybackTime(musicPlayer.duration)}</span></div>
          <div className="media-controls music-stage__controls">
            <button className={musicPlayer.shuffled ? "active" : ""} type="button" aria-label="Toggle shuffle" onClick={() => onMusicAction("shuffle")}><Icon name="Shuffle" size={20} /></button>
            <button type="button" aria-label="Previous track" onClick={() => onMusicAction("previous")}><Icon name="SkipBack" size={26} /></button>
            <button className="play-button" type="button" aria-label={musicPlayer.playing ? "Pause" : "Play"} onClick={() => onMusicAction(musicPlayer.playing ? "pause" : "play")}><Icon name={musicPlayer.playing ? "Pause" : "Play"} size={28} /></button>
            <button type="button" aria-label="Next track" onClick={() => onMusicAction("next")}><Icon name="SkipForward" size={26} /></button>
            <button className={musicPlayer.muted ? "active" : ""} type="button" aria-label="Toggle mute" onClick={() => onMusicAction("mute")}><Icon name={musicPlayer.muted ? "VolumeX" : "Volume2"} size={21} /></button>
          </div>
          <div className="music-stage__queue"><Icon name="Music2" size={17} /><span>{musicConnection.sourceUrl ? `Use the ${musicProvider.shortName} player below to choose a track. Controls stay active across Live Desktop tabs.` : `Choose a ${musicProvider.contentLabel} in Settings.`}</span></div>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const [profiles, setProfiles] = useState(readProfiles);
  const [profileId] = useState(activeProfileId);
  const [activeView, setActiveView] = useState("home");
  const [system, setSystem] = useState(FALLBACK_SYSTEM);
  const [apps, setApps] = useState([]);
  const [phone, setPhone] = useState({ installed: false, running: false, connected: false, detail: "Checking Phone Link" });
  const [calendar, setCalendar] = useState(EMPTY_ICLOUD_CALENDAR);
  const [runtime, setRuntime] = useState({ backendOnline: false, frontendOnline: true });
  const [health, setHealth] = useState({ connected: false, configured: false });
  const [actions, setActions] = useState([]);
  const [memories, setMemories] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [pendingControl, setPendingControl] = useState(null);
  const [phoneRefreshing, setPhoneRefreshing] = useState(false);
  const [calendarRefreshing, setCalendarRefreshing] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [lifecycleState, setLifecycleState] = useState("idle");
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [darkMode, setDarkMode] = useState(() => (window.localStorage.getItem(profileStorageKey(THEME_KEY, profileId)) || (profileId === "default" ? window.localStorage.getItem(THEME_KEY) : null)) !== "light");
  const [accentColor, setAccentColor] = useState(() => readAccentColor(window.localStorage, profileStorageKey(ACCENT_COLOR_KEY, profileId)));
  const [musicIntegration, setMusicIntegration] = useState(() => readMusicIntegration(profileId));
  const musicProviderId = musicIntegration.provider;
  const musicProvider = MUSIC_PROVIDERS[musicProviderId];
  const musicConnection = musicIntegration.connections[musicProviderId];
  const [musicPlayer, setMusicPlayer] = useState(() => emptyMusicPlayerFor(musicProviderId));
  const [openAiSettings, setOpenAiSettings] = useState({ openAiConfigured: false, profileApiKey: false });
  const activeProfile = profiles.find((profile) => profile.id === profileId) || profiles[0];

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem(profileStorageKey(THEME_KEY, profileId), darkMode ? "dark" : "light");
  }, [darkMode, profileId]);

  useEffect(() => {
    const appliedAccent = effectiveAccentColor(accentColor, darkMode);
    document.documentElement.style.setProperty("--accent", appliedAccent);
    document.documentElement.style.setProperty("--accent-soft", accentSoftColor(appliedAccent));
    document.documentElement.style.setProperty("--accent-foreground", accentForegroundColor(appliedAccent));
    window.localStorage.setItem(profileStorageKey(ACCENT_COLOR_KEY, profileId), accentColor);
  }, [accentColor, darkMode, profileId]);

  const setCustomAccentColor = (hexCode) => {
    const normalized = normalizeHexColor(hexCode);
    setAccentColor(normalized);
    return normalized;
  };

  useEffect(() => {
    window.localStorage.setItem(profileStorageKey(MUSIC_CONNECTION_KEY, profileId), JSON.stringify(musicIntegration));
  }, [musicIntegration, profileId]);

  const updateProfiles = (nextProfiles) => {
    setProfiles(nextProfiles);
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles));
  };

  const switchProfile = (nextId) => {
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, nextId);
    window.location.reload();
  };

  const deleteProfile = async (id) => {
    if (id === "default" || profiles.length === 1) return;
    try {
      await api("/api/profile/data", { method: "DELETE" });
      const next = profiles.filter((profile) => profile.id !== id);
      updateProfiles(next);
      switchProfile(next[0].id);
    } catch (error) { notify(error.message, "error"); }
  };

  const notify = useCallback((message, tone = "neutral") => {
    setToast({ message, tone });
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const loadDashboard = useCallback(async () => {
    const results = await Promise.allSettled([
      api("/health"),
      api("/api/system"),
      api("/api/system/apps"),
      api("/api/integrations/phone-link"),
      api("/api/actions"),
      api("/api/memories"),
      api("/api/conversations"),
      api("/api/runtime"),
      api(`/api/integrations/icloud-calendar?date=${localIsoDate(localDateAtOffset())}`),
      api("/api/profile/settings"),
    ]);
    if (results[0].status === "fulfilled") setHealth({ connected: true, configured: Boolean(results[0].value.openAiConfigured) });
    else setHealth({ connected: false, configured: false });
    if (results[1].status === "fulfilled") setSystem(results[1].value);
    if (results[2].status === "fulfilled") setApps(results[2].value);
    if (results[3].status === "fulfilled") setPhone(results[3].value);
    if (results[4].status === "fulfilled") setActions(results[4].value);
    if (results[5].status === "fulfilled") setMemories(results[5].value);
    if (results[6].status === "fulfilled") setConversations(results[6].value);
    if (results[7].status === "fulfilled") setRuntime(results[7].value);
    if (results[8].status === "fulfilled") setCalendar(results[8].value);
    if (results[9].status === "fulfilled") setOpenAiSettings(results[9].value);
  }, []);

  const refreshMusicPlayer = useCallback(async (announce = false) => {
    try {
      const latest = await api(`/api/integrations/media-session?provider=${musicProviderId}`);
      setMusicPlayer((current) => ({ ...current, ...latest }));
      if (announce) notify(latest.available ? "Windows media session refreshed." : latest.detail, latest.available ? "success" : "neutral");
      return latest;
    } catch (error) {
      if (announce) notify(error.message, "error");
      return null;
    }
  }, [musicProviderId, notify]);

  const refreshPhone = useCallback(async (announce = false) => {
    setPhoneRefreshing(true);
    try {
      const latest = await api(`/api/integrations/phone-link?refresh=${Date.now()}`);
      setPhone(latest);
      if (announce) notify("Phone Link information refreshed.", "success");
    } catch (error) {
      if (announce) notify(error.message, "error");
    } finally {
      setPhoneRefreshing(false);
    }
  }, [notify]);

  const refreshCalendar = useCallback(async (date, announce = false) => {
    setCalendarRefreshing(true);
    try {
      const latest = await api(`/api/integrations/icloud-calendar?date=${date}${announce ? `&refresh=${Date.now()}` : ""}`);
      setCalendar(latest);
      if (announce) notify("iCloud Calendar refreshed.", "success");
    } catch (error) {
      if (announce) notify(error.message, "error");
    } finally {
      setCalendarRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    loadDashboard();
    refreshMusicPlayer(false);
    const timer = window.setInterval(loadDashboard, 15000);
    const phoneTimer = window.setInterval(() => refreshPhone(false), 5000);
    const mediaTimer = window.setInterval(() => refreshMusicPlayer(false), 5000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(phoneTimer);
      window.clearInterval(mediaTimer);
    };
  }, [loadDashboard, refreshPhone, refreshMusicPlayer]);

  const controls = useMemo(() => {
    const byId = new Map(system.controls.map((control) => [control.id, control]));
    return CONTROL_ORDER.map((id) => ({ ...CONTROL_META[id], ...byId.get(id), id }));
  }, [system]);

  const pendingCount = actions.filter((action) => action.status === "pending").length;

  const queueControl = async (id) => {
    setPendingControl(id);
    try {
      await api(`/api/system/controls/${id}`, { method: "POST" });
      notify(`${CONTROL_META[id].label} settings added to approvals.`, "success");
      await loadDashboard();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setPendingControl(null);
    }
  };

  const openPhone = async () => {
    setPendingControl("phone");
    try {
      await api("/api/integrations/phone-link/open", { method: "POST" });
      notify("Phone Link launch added to approvals. The dashboard will stay open.", "success");
      await loadDashboard();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setPendingControl(null);
    }
  };

  const copyPhoneName = async () => {
    try {
      await navigator.clipboard.writeText(phone.deviceName || "Linked phone");
      notify("Device name copied.", "success");
    } catch {
      notify("Clipboard access is unavailable in this browser.", "error");
    }
  };

  const copySystemInfo = async () => {
    const device = system.device || FALLBACK_SYSTEM.device;
    const windows = system.windows || FALLBACK_SYSTEM.windows;
    const graphics = device.graphics?.map((item) => item.name).join(", ") || "Unavailable";
    const summary = [
      `Device name: ${system.host.name}`,
      `Manufacturer: ${device.manufacturer}`,
      `Model: ${device.model}`,
      `Processor: ${device.processorName}`,
      `Installed RAM: ${formatBytes(device.installedMemoryBytes || system.resources.memoryTotalBytes)}`,
      `Graphics: ${graphics}`,
      `System type: ${device.systemType}`,
      `Device ID: ${device.deviceId}`,
      `Product ID: ${device.productId}`,
      `Windows edition: ${windows.edition}`,
      `Windows version: ${windows.version}`,
      `OS build: ${windows.build}`,
      `Architecture: ${windows.architecture}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      notify("System information copied.", "success");
    } catch {
      notify("Clipboard access is unavailable in this browser.", "error");
    }
  };

  const runLifecycle = async (action) => {
    if (lifecycleState !== "idle") return;
    setShutdownOpen(false);
    setLifecycleState(action === "restart" ? "restarting" : "shutting-down");
    try {
      await api(`/api/runtime/${action}`, { method: "POST" });
      if (action === "shutdown") {
        await delay(1800);
        setLifecycleState("offline");
        return;
      }
      const ready = await waitForRestartReady();
      if (!ready) throw new Error("Live Desktop did not come back online within one minute.");
      window.location.reload();
    } catch (error) {
      setLifecycleState("idle");
      notify(error.message, "error");
    }
  };

  const updateAction = async (id, verb) => {
    try {
      const updated = await api(`/api/actions/${id}/${verb}`, { method: "POST" });
      notify(verb === "approve" ? (updated.status === "completed" ? "Action completed." : "Action could not complete.") : "Action rejected.", updated.status === "failed" ? "error" : "success");
      await loadDashboard();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const createMemory = async (content, category) => {
    try {
      await api("/api/memories", { method: "POST", body: JSON.stringify({ content, category }) });
      notify("Memory saved locally.", "success");
      await loadDashboard();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const deleteMemory = async (id) => {
    try {
      await api(`/api/memories/${id}`, { method: "DELETE" });
      notify("Memory forgotten.", "success");
      await loadDashboard();
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const selectConversation = async (summary) => {
    if (!summary) {
      setSelectedConversation(null);
      return;
    }
    try {
      setSelectedConversation(await api(`/api/conversations/${summary.id}`));
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const sendMessage = async (message, conversationId = selectedConversation?.id) => {
    setAssistantBusy(true);
    try {
      const result = await api("/api/chat", { method: "POST", body: JSON.stringify({ message, conversationId }) });
      setActiveView("conversations");
      await loadDashboard();
      await selectConversation({ id: result.conversationId });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setAssistantBusy(false);
    }
  };

  const connectICloudCalendar = async (email, appSpecificPassword) => {
    const connectedCalendar = await api("/api/integrations/icloud-calendar/connect", {
      method: "POST",
      body: JSON.stringify({ email, appSpecificPassword }),
    });
    setCalendar(connectedCalendar);
    notify("iCloud Calendar connected and synced.", "success");
  };

  const disconnectICloudCalendar = async () => {
    try {
      setCalendar(await api("/api/integrations/icloud-calendar", { method: "DELETE" }));
      notify("iCloud Calendar disconnected. Stored credentials were removed.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const controlMusic = async (action) => {
    try {
      if (!musicPlayer.available) {
        setActiveView("music");
        notify(`Start a track in the ${musicProvider.shortName} player once, then these controls will follow it through Windows.`, "neutral");
        return;
      }
      const updated = await api(`/api/integrations/media-session/${action}?provider=${musicProviderId}`, { method: "POST" });
      setMusicPlayer((current) => ({ ...current, ...updated, muted: action === "mute" ? !current.muted : current.muted }));
      if (updated.actionSucceeded === false) notify("That media session did not accept the command.", "error");
    } catch (error) {
      notify(error.message || "Windows could not complete that media action.", "error");
    }
  };

  const saveMusicConnection = (connection) => {
    setMusicIntegration((current) => ({
      ...current,
      connections: { ...current.connections, [current.provider]: connection },
    }));
    notify(`${musicProvider.name} link connected.`, "success");
  };

  const disconnectMusic = () => {
    setMusicIntegration((current) => ({
      ...current,
      connections: { ...current.connections, [current.provider]: { ...EMPTY_MUSIC_CONNECTION } },
    }));
    notify(`${musicProvider.name} link disconnected.`, "success");
  };

  const switchMusicProvider = (providerId) => {
    if (providerId === musicProviderId || !MUSIC_PROVIDERS[providerId]) return;
    setMusicIntegration((current) => ({ ...current, provider: providerId }));
    setMusicPlayer(emptyMusicPlayerFor(providerId));
    notify(`${MUSIC_PROVIDERS[providerId].name} now powers the Music widgets.`, "success");
  };

  const saveOpenAiKey = async (apiKey) => {
    const saved = await api("/api/profile/openai-key", { method: "POST", body: JSON.stringify({ apiKey }) });
    setOpenAiSettings(saved);
    setHealth((current) => ({ ...current, configured: true }));
    notify("OpenAI API key saved for this profile.", "success");
  };

  const deleteOpenAiKey = async () => {
    const saved = await api("/api/profile/openai-key", { method: "DELETE" });
    setOpenAiSettings(saved);
    setHealth((current) => ({ ...current, configured: saved.openAiConfigured }));
    notify("This profile’s OpenAI API key was removed.", "success");
  };

  return (
    <div className="desktop-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setActiveView("home")}><AppLogo /><span><strong>Live Desktop</strong><small>Your local Windows assistant</small></span></button>
        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => <button type="button" key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)}><Icon name={item.icon} size={19} />{item.label}{item.id === "approvals" && pendingCount ? <b>{pendingCount}</b> : null}</button>)}
        </nav>
        <div className="topbar-actions">
          <span className="local-status"><i className={health.connected && runtime.frontendOnline ? "" : "offline"} /><strong>{health.connected ? "Local mode" : "Preview mode"}</strong><small>{health.connected ? "All data stays on this PC" : "Backend is offline"}</small></span>
          <div className="lifecycle-actions" aria-label="Project lifecycle controls">
            <button type="button" aria-label="Restart frontend and backend" title="Restart frontend and backend" onClick={() => runLifecycle("restart")} disabled={lifecycleState !== "idle"}>
              <Icon name="RotateCw" size={18} className={lifecycleState === "restarting" ? "spin" : ""} />
            </button>
            <button className="shutdown-button" type="button" aria-label="Shut down frontend and backend" title="Shut down frontend and backend" onClick={() => setShutdownOpen(true)} disabled={lifecycleState !== "idle"}>
              <Icon name="Power" size={18} />
            </button>
          </div>
          <button type="button" className={`settings-button ${activeView === "settings" ? "active" : ""}`} aria-label="Settings" onClick={() => setActiveView("settings")}><Icon name="Settings" size={20} /><span>Settings</span></button>
          <ProfilePicker profiles={profiles} activeProfile={activeProfile} onProfilesChange={updateProfiles} onSwitch={switchProfile} onDelete={deleteProfile} />
        </div>
      </header>

      {activeView === "home" ? <main className="home-view">
          <section id="system-controls" className="control-strip" aria-label="System controls" tabIndex={-1}>
            {controls.map((control) => (
              <div className="control-item" key={control.id}>
                <Icon name={control.icon} size={26} className={control.enabled ? "control-icon--active" : ""} />
                <div><strong>{control.label}</strong><span>{control.detail === "Opens Windows settings after approval" ? CONTROL_META[control.id].detail : control.detail}</span></div>
                <Toggle enabled={control.enabled} pending={pendingControl === control.id} disabled={!control.available} onClick={() => queueControl(control.id)} label={control.label} />
              </div>
            ))}
          </section>
          <button className="capability-notice" type="button" onClick={() => setActiveView("approvals")}>
            <Icon name="Info" size={18} /><span>System controls open the matching Windows setting after your approval.</span><b>Review device control</b><Icon name="ChevronRight" size={16} />
          </button>
          <div className="dashboard-grid">
            <section className="today-panel">
              <header><h1>Today on your PC</h1><p>Sunday, August 2, 2026</p></header>
              <div className="today-columns">
                <SystemHealth system={system} connected={health.connected} configured={health.configured} onOpenSystem={() => setActiveView("system")} />
                <RecentApps apps={apps} />
                <CalendarAndMedia calendar={calendar} calendarRefreshing={calendarRefreshing} musicProvider={musicProvider} musicPlayer={musicPlayer} musicConfigured={Boolean(musicConnection.embedUrl)} onCalendarDateChange={(date) => refreshCalendar(date, false)} onRefreshCalendar={(date) => refreshCalendar(date, true)} onOpenCalendarSettings={() => setActiveView("settings")} onOpenMusic={() => setActiveView("music")} onMusicAction={controlMusic} />
              </div>
            </section>
            <PhonePanel
              phone={phone}
              onOpen={openPhone}
              onRefresh={() => refreshPhone(true)}
              onCopy={copyPhoneName}
              busy={pendingControl === "phone"}
              refreshing={phoneRefreshing}
            />
          </div>
          {activeView === "home" ? <AssistantBar onSubmit={sendMessage} busy={assistantBusy} /> : null}
          {activeView === "home" ? <p className="privacy-note">Local first. Private by design.</p> : null}
      </main> : null}

      {activeView === "system" ? <SystemInfoView system={system} connected={health.connected} configured={health.configured} onCopy={copySystemInfo} /> : null}

      {activeView === "approvals" ? <ApprovalsView actions={actions} loading={false} onApprove={(id) => updateAction(id, "approve")} onReject={(id) => updateAction(id, "reject")} /> : null}
      {activeView === "memories" ? <MemoriesView memories={memories} onCreate={createMemory} onDelete={deleteMemory} /> : null}
      {activeView === "conversations" ? <ConversationsView conversations={conversations} selected={selectedConversation} onSelect={selectConversation} onSend={sendMessage} busy={assistantBusy} /> : null}
      {activeView === "music" ? <MusicView musicProvider={musicProvider} musicConnection={musicConnection} musicPlayer={musicPlayer} onMusicAction={controlMusic} onOpenSettings={() => setActiveView("settings")} /> : null}
      {musicConnection.embedUrl ? <div className={`music-web-player music-web-player--${musicProviderId} ${activeView === "music" ? "" : "music-web-player--parked"}`} aria-hidden={activeView !== "music"}><iframe key={`${musicProviderId}:${musicConnection.embedUrl}`} title={`${musicProvider.name} web player`} src={musicConnection.embedUrl} allow={musicProviderId === "apple" ? "autoplay *; encrypted-media *; fullscreen *; clipboard-write" : "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"} loading="eager" /></div> : null}
      {activeView === "settings" ? <SettingsView darkMode={darkMode} onDarkModeChange={setDarkMode} accentColor={accentColor} onAccentColorChange={setAccentColor} onCustomAccentColorChange={setCustomAccentColor} calendar={calendar} onConnectCalendar={connectICloudCalendar} onDisconnectCalendar={disconnectICloudCalendar} musicProviderId={musicProviderId} musicConnection={musicConnection} musicPlayer={musicPlayer} onMusicProviderChange={switchMusicProvider} onSaveMusic={saveMusicConnection} onDisconnectMusic={disconnectMusic} onRefreshMusic={() => refreshMusicPlayer(true)} onOpenMusic={() => setActiveView("music")} openAiSettings={openAiSettings} onSaveOpenAiKey={saveOpenAiKey} onDeleteOpenAiKey={deleteOpenAiKey} /> : null}

      {shutdownOpen ? <ShutdownDialog onCancel={() => setShutdownOpen(false)} onConfirm={() => runLifecycle("shutdown")} /> : null}
      <LifecycleNotice state={lifecycleState} />
      {toast ? <div className={`toast toast--${toast.tone}`} role="status"><Icon name={toast.tone === "error" ? "CircleAlert" : "CircleCheck"} size={18} />{toast.message}<button type="button" onClick={() => setToast(null)} aria-label="Dismiss"><Icon name="X" size={16} /></button></div> : null}
    </div>
  );
}
