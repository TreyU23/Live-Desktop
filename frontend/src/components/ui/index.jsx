import { FiActivity, FiAlertCircle, FiBattery, FiBatteryCharging, FiBellOff, FiBluetooth, FiBookmark, FiCalendar, FiCamera, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiCircle, FiClipboard, FiCopy, FiCpu, FiExternalLink, FiGlobe, FiGrid, FiHardDrive, FiHome, FiInfo, FiLayers, FiLink2, FiLoader, FiMail, FiMessageCircle, FiMessageSquare, FiMic, FiMonitor, FiMoon, FiMusic, FiPause, FiPieChart, FiPlay, FiPlus, FiPower, FiRefreshCw, FiRotateCw, FiSearch, FiSend, FiServer, FiSettings, FiShield, FiShuffle, FiSkipBack, FiSkipForward, FiSmartphone, FiSquare, FiSun, FiUpload, FiUser, FiUsers, FiTrash2, FiVolume2, FiVolumeX, FiWifi, FiX, FiZap } from "react-icons/fi";
const FeatherIcons = { FiActivity, FiAlertCircle, FiBattery, FiBatteryCharging, FiBellOff, FiBluetooth, FiBookmark, FiCalendar, FiCamera, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiCircle, FiClipboard, FiCopy, FiCpu, FiExternalLink, FiGlobe, FiGrid, FiHardDrive, FiHome, FiInfo, FiLayers, FiLink2, FiLoader, FiMail, FiMessageCircle, FiMessageSquare, FiMic, FiMonitor, FiMoon, FiMusic, FiPause, FiPieChart, FiPlay, FiPlus, FiPower, FiRefreshCw, FiRotateCw, FiSearch, FiSend, FiServer, FiSettings, FiShield, FiShuffle, FiSkipBack, FiSkipForward, FiSmartphone, FiSquare, FiSun, FiUpload, FiUser, FiUsers, FiTrash2, FiVolume2, FiVolumeX, FiWifi, FiX, FiZap };

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

export function Icon({ name, size = 20, strokeWidth = 1.75, className = "" }) {
  const Component = FeatherIcons[ICON_COMPONENTS[name]] || FeatherIcons.FiCircle;
  return <span className={`icon ${className}`} aria-hidden="true"><Component size={size} strokeWidth={strokeWidth} /></span>;
}

export function AppLogo({ small = false }) {
  return (
    <span className={`app-logo ${small ? "app-logo--small" : ""}`} aria-hidden="true">
      <Icon name="Sparkles" size={small ? 18 : 22} strokeWidth={2.2} />
    </span>
  );
}

export function EmptyState({ icon, title, detail }) {
  return <div className="empty-state"><Icon name={icon} size={28} /><h3>{title}</h3><p>{detail}</p></div>;
}

export function ViewShell({ title, detail, children }) {
  return <main className="view-shell"><header className="page-heading"><div><h1 tabIndex={-1}>{title}</h1><p>{detail}</p></div></header>{children}</main>;
}

export function InfoLine({ icon, label, value, healthy }) {
  return (
    <div className="info-line">
      <Icon name={icon} size={19} />
      <strong>{label}</strong>
      <span title={value}>{value}</span>
      {healthy !== undefined ? <i className={`status-dot ${healthy ? "status-dot--good" : "status-dot--warn"}`} /> : null}
    </div>
  );
}

export function DetailRows({ rows }) {
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
