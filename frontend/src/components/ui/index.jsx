import { Page } from "../shell/Page.jsx";
import { FiActivity, FiAlertCircle, FiArrowUp, FiArrowUpRight, FiBattery, FiBatteryCharging, FiBellOff, FiBluetooth, FiBookmark, FiCalendar, FiCamera, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiCircle, FiClipboard, FiCopy, FiCpu, FiExternalLink, FiGlobe, FiGrid, FiHardDrive, FiHome, FiInfo, FiLayers, FiLink2, FiLoader, FiMail, FiMessageCircle, FiMessageSquare, FiMic, FiMonitor, FiMoon, FiMusic, FiPause, FiPieChart, FiPlay, FiPlus, FiPower, FiRefreshCw, FiRotateCw, FiSearch, FiSend, FiServer, FiSettings, FiShield, FiShuffle, FiSkipBack, FiSkipForward, FiSmartphone, FiSquare, FiSun, FiUpload, FiUser, FiUsers, FiTrash2, FiVolume2, FiVolumeX, FiWifi, FiX, FiZap } from "react-icons/fi";
const FeatherIcons = { FiActivity, FiAlertCircle, FiArrowUp, FiArrowUpRight, FiBattery, FiBatteryCharging, FiBellOff, FiBluetooth, FiBookmark, FiCalendar, FiCamera, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiCircle, FiClipboard, FiCopy, FiCpu, FiExternalLink, FiGlobe, FiGrid, FiHardDrive, FiHome, FiInfo, FiLayers, FiLink2, FiLoader, FiMail, FiMessageCircle, FiMessageSquare, FiMic, FiMonitor, FiMoon, FiMusic, FiPause, FiPieChart, FiPlay, FiPlus, FiPower, FiRefreshCw, FiRotateCw, FiSearch, FiSend, FiServer, FiSettings, FiShield, FiShuffle, FiSkipBack, FiSkipForward, FiSmartphone, FiSquare, FiSun, FiUpload, FiUser, FiUsers, FiTrash2, FiVolume2, FiVolumeX, FiWifi, FiX, FiZap };

const ICON_COMPONENTS = {
  Activity: "FiActivity", ArrowUp: "FiArrowUp", ArrowUpRight: "FiArrowUpRight", AppWindow: "FiSquare", BatteryCharging: "FiBatteryCharging",
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
  Wifi: "FiWifi", X: "FiX", Zap: "FiZap",
};

export function Icon({ name, size = 20, strokeWidth = 1.75, className = "" }) {
  const Component = FeatherIcons[ICON_COMPONENTS[name]] || FeatherIcons.FiCircle;
  return <span className={`icon ${className}`} aria-hidden="true"><Component size={size} strokeWidth={strokeWidth} /></span>;
}

export function EmptyState({ icon, title, detail, children }) {
  return <div className="empty-state"><Icon name={icon} size={28} /><h3>{title}</h3><p>{detail}</p>{children}</div>;
}

// Transitional: legacy views keep their class names inside the Astryx page frame until each view moves.
export function ViewShell({ title, detail, actions, className = "", children }) {
  return <Page title={title} detail={detail} actions={actions}><div className={`legacy view-shell ${className}`.trim()}>{children}</div></Page>;
}

export function InfoLine({ icon, label, value, healthy }) {
  return (
    <div className="info-line">
      {icon ? <Icon name={icon} size={16} className="muted" /> : null}
      <span className="group__label">{label}</span>
      <span className="group__value group__value--end" title={value}>{value}</span>
      {healthy !== undefined ? <i className={`status-dot ${healthy ? "status-dot--good" : "status-dot--warn"}`} aria-hidden="true" /> : null}
    </div>
  );
}

export function DetailRows({ rows }) {
  return (
    <dl className="group system-detail-list">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd title={String(row.value)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
