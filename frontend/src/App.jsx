import { formatBytes, localIsoDate, localDateAtOffset } from './presentation/formatters.js';
import { SystemInfoView } from './views/SystemInfoView.jsx';
import { SettingsView } from './views/SettingsView.jsx';
import { HomeView } from './views/HomeView.jsx';
import { ApprovalsView } from './views/ApprovalsView.jsx';
import { MemoriesView } from './views/MemoriesView.jsx';
import { ConversationsView } from './views/ConversationsView.jsx';
import { MusicView } from './views/MusicView.jsx';
import { MusicFrame } from './components/media/MusicFrame.jsx';
import { Navigation } from './components/shell/Navigation.jsx';
import { ProfileMenu, ProfileDialog } from './components/shell/ProfileMenu.jsx';
import { icons } from './components/ui/icons.js';
import { AppShell } from '@astryxdesign/core/AppShell';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Icon as AstryxIcon } from '@astryxdesign/core/Icon';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { ToastViewport, useToast } from '@astryxdesign/core/Toast';
import { ResourceBoundary } from './components/feedback/ResourceBoundary.jsx';
import { adaptResourceStatus } from './presentation/resourceViewState.js';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { themes, defaultThemeSlug } from "./astryx-themes.js";
import {
  EMPTY_MUSIC_CONNECTION,
  MUSIC_PROVIDERS,
  migrateMusicIntegration,
} from "./musicProviders.js";
import { accentPreset, readAccentPreset } from "./accentColors.js";
import { applyCompletedControlAction, upsertAction } from "./systemControls.js";
import { createResourceScheduler } from "./resourceScheduler.js";
import { recordTiming } from "./performanceDiagnostics.js";
import { DEFAULT_ASSISTANT_PROVIDER, assistantProvider, providerModel } from "./assistantProviders.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const CONTROL_META = {
  wifi: { label: "Wi-Fi", detail: "Unavailable", icon: "Wifi" },
  bluetooth: { label: "Bluetooth", detail: "On", icon: "Bluetooth" },
  focus: { label: "Focus", detail: "Off", icon: "Moon" },
  "night-light": { label: "Night light", detail: "Unavailable", icon: "Sun" },
  microphone: { label: "Mic privacy", detail: "Allowed", icon: "Mic" },
  "battery-saver": { label: "Battery saver", detail: "Off", icon: "BatteryCharging" },
};

const CONTROL_ORDER = ["wifi", "bluetooth", "focus", "night-light", "microphone", "battery-saver"];

const FALLBACK_SYSTEM = {
  host: {
    name: "LOCAL-DESKTOP",
    user: "Local user",
    os: "Windows",
    osVersion: "Unavailable",
    architecture: "x64",
    javaVersion: 21,
  },
  resources: {
    cpuPercent: null,
    memoryUsedBytes: null,
    memoryTotalBytes: null,
    storageUsedBytes: null,
    storageTotalBytes: null,
    network: {
      name: "Unavailable",
      address: "Waiting for system data",
      connected: false,
      rxBytesPerSec: null,
      txBytesPerSec: null,
      ratesAvailable: false,
    },
    battery: { available: false, percent: null, detail: "Waiting for system data" },
    diskActivity: { available: false, readBytesPerSec: null, writeBytesPerSec: null },
  },
  controls: CONTROL_ORDER.map((id) => ({
    id,
    label: CONTROL_META[id].label,
    enabled: false,
    available: false,
    direct: ["wifi", "bluetooth"].includes(id),
    detail: "Waiting for system data",
  })),
  device: {
    manufacturer: "Unavailable",
    model: "Unavailable",
    processorName: "Processor information unavailable",
    processorCores: 0,
    processorLogicalProcessors: 0,
    maxClockMhz: 0,
    installedMemoryBytes: 0,
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

const kEmptyAssistantSettings = { provider: DEFAULT_ASSISTANT_PROVIDER, assistantConfigured: false, openAiConfigured: false, profileApiKey: false, anthropicConfigured: false, profileAnthropicKey: false, models: {} };

function emptyMusicPlayerFor(providerId) {
  const provider = MUSIC_PROVIDERS[providerId] || MUSIC_PROVIDERS.apple;
  return {
    ...EMPTY_MUSIC_PLAYER,
    artist: provider.name,
    album: `Start a track in ${provider.name} or its web player`,
  };
}

const SYSTEM_SERIES_CAP = 60;

function systemSeriesSample(snapshot) {
  const resources = snapshot?.resources || {};
  const memoryTotal = resources.memoryTotalBytes;
  const storageTotal = resources.storageTotalBytes;
  const memory = Number.isFinite(resources.memoryUsedBytes) && memoryTotal > 0
    ? (resources.memoryUsedBytes / memoryTotal) * 100
    : null;
  const storage = Number.isFinite(resources.storageUsedBytes) && storageTotal > 0
    ? (resources.storageUsedBytes / storageTotal) * 100
    : null;
  return {
    t: snapshot?.capturedAt || new Date().toISOString(),
    cpu: Number.isFinite(resources.cpuPercent) ? resources.cpuPercent : null,
    memory,
    storage,
    netRx: resources.network?.ratesAvailable ? resources.network.rxBytesPerSec : null,
    netTx: resources.network?.ratesAvailable ? resources.network.txBytesPerSec : null,
    diskRead: resources.diskActivity?.available ? resources.diskActivity.readBytesPerSec : null,
    diskWrite: resources.diskActivity?.available ? resources.diskActivity.writeBytesPerSec : null,
  };
}

const PROFILES_KEY = "live-desktop.profiles";
const ACTIVE_PROFILE_KEY = "live-desktop.active-profile";
const MUSIC_CONNECTION_KEY = "live-desktop.apple-music";
const THEME_KEY = "live-desktop.theme";
const TRANSPARENCY_KEY = "live-desktop.reduce-transparency";
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

const kAppearances = ["system", "light", "dark"];
// Saved values from the glass UI were "light" or "dark"; "system" follows Windows.
function readAppearance(profileId) {
  const saved = window.localStorage.getItem(profileStorageKey(THEME_KEY, profileId)) || (profileId === "default" ? window.localStorage.getItem(THEME_KEY) : null);
  return kAppearances.includes(saved) ? saved : "system";
}

const kDarkQuery = "(prefers-color-scheme: dark)";
function subscribeColorScheme(onChange) {
  const query = window.matchMedia(kDarkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function prefersDark() { return window.matchMedia(kDarkQuery).matches; }

function activeProfileId() {
  const profiles = readProfiles();
  const saved = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
  return profiles.some((profile) => profile.id === saved) ? saved : profiles[0].id;
}

function profileStorageKey(base, profileId = activeProfileId()) {
  return `${base}.${profileId}`;
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

let localAccessTokenValue = "";
let localAccessSettled = false;
let localAccessTokenTask = null;
let localAccessGeneration = 0;

function resetLocalAccessToken() {
  localAccessGeneration += 1;
  localAccessTokenValue = "";
  localAccessSettled = false;
  localAccessTokenTask = null;
}

function localAccessToken() {
  if (localAccessSettled) return Promise.resolve(localAccessTokenValue);
  if (!localAccessTokenTask) {
    const generation = localAccessGeneration;
    localAccessTokenTask = fetch(`${API_BASE}/health`, { cache: "no-store" })
      .then((response) => {
        if (generation !== localAccessGeneration) return localAccessTokenValue;
        const token = response.headers.get("X-Live-Desktop-Token") || "";
        if (response.ok) {
          localAccessTokenValue = token;
          localAccessSettled = true;
        }
        return localAccessTokenValue;
      })
      .catch(() => localAccessTokenValue)
      .finally(() => {
        if (generation === localAccessGeneration) localAccessTokenTask = null;
      });
  }
  return localAccessTokenTask;
}

async function api(path, options = {}, allowTokenRefresh = true) {
  const { profileId = activeProfileId(), headers, ...requestOptions } = options;
  const method = String(requestOptions.method || "GET").toUpperCase();
  const token = await localAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    cache: "no-store",
    headers: {
      ...headers,
      "X-Profile-Id": profileId,
      ...(token ? { "X-Live-Desktop-Token": token } : {}),
      ...(method === "POST" || method === "DELETE" ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (response.status === 403 && allowTokenRefresh) {
    resetLocalAccessToken();
    return api(path, options, false);
  }
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
      resetLocalAccessToken();
      const token = await localAccessToken();
      const response = await fetch(`${API_BASE}/api/runtime?restart=${Date.now()}`, {
        cache: "no-store",
        headers: token ? { "X-Live-Desktop-Token": token } : {},
      });
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











// Restart/stop affect Live Desktop's own services, never Windows.
function LifecycleBanner({ state }) {
  if (state === "idle") return null;
  const restarting = state === "restarting";
  return <Banner status={restarting ? "info" : "warning"} container="section"
    title={restarting ? "Restarting Live Desktop" : "Live Desktop services are off"}
    description={restarting ? "The dashboard will reconnect and reload automatically." : "Run start.cmd in the application folder to start the services again."} />;
}

// Shows each notify() call through Astryx's toast viewport. Rendered inside <Theme> so toasts are themed.
function ToastBridge({ toast }) {
  const showToast = useToast();
  useEffect(() => {
    if (toast) showToast({ body: toast.message, type: toast.tone === "error" ? "error" : "info", uniqueID: String(toast.id) });
  }, [toast, showToast]);
  return null;
}

export function App() {
  const [profiles, setProfiles] = useState(readProfiles);
  const [profileId] = useState(activeProfileId);
  const [activeView, setActiveView] = useState("home");
  const sendPending = useRef(false);
  const controlPending = useRef(false);
  const [profileDelete, setProfileDelete] = useState(null);
  const [profileDeleting, setProfileDeleting] = useState(false);
  const shownView = useRef("home");
  useEffect(() => {
    // Move focus to the new view's heading and reset the scroll position of AppShell's content area.
    // Not on first load: focus stays at the top of the document there.
    // Compares views rather than counting runs, so StrictMode's double effect in development is a no-op.
    if (shownView.current === activeView) return;
    shownView.current = activeView;
    const main = document.querySelector('main, [role="main"]');
    const heading = main?.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    let scroller = main;
    while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    scroller?.scrollTo?.(0, 0);
  }, [activeView]);
  const [musicMounted, setMusicMounted] = useState(false);
  useEffect(() => { if (activeView === "music") setMusicMounted(true); }, [activeView]);
  const [system, setSystem] = useState(FALLBACK_SYSTEM);
  const [systemSeries, setSystemSeries] = useState([]);
  const [apps, setApps] = useState([]);
  const [phone, setPhone] = useState({ installed: false, running: false, connected: false, detail: "Checking Phone Link" });
  const [calendar, setCalendar] = useState(EMPTY_ICLOUD_CALENDAR);
  const [runtime, setRuntime] = useState({ backendOnline: false, frontendOnline: true });
  const [health, setHealth] = useState({ connected: false, configured: false, provider: DEFAULT_ASSISTANT_PROVIDER });
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [appearance, setAppearance] = useState(() => readAppearance(profileId));
  const systemDark = useSyncExternalStore(subscribeColorScheme, prefersDark);
  const darkMode = appearance === "dark" || (appearance === "system" && systemDark);
  const [accentId, setAccentId] = useState(() => readAccentPreset(window.localStorage, profileStorageKey(ACCENT_COLOR_KEY, profileId)));
  const accent = accentPreset(accentId);
  const [musicIntegration, setMusicIntegration] = useState(() => readMusicIntegration(profileId));
  const musicProviderId = musicIntegration.provider;
  const musicProvider = MUSIC_PROVIDERS[musicProviderId];
  const musicConnection = musicIntegration.connections[musicProviderId];
  const [musicPlayer, setMusicPlayer] = useState(() => emptyMusicPlayerFor(musicProviderId));
  const [assistantSettings, setAssistantSettings] = useState(kEmptyAssistantSettings);
  const [resourceStatus, setResourceStatus] = useState({});
  const resourceStates = useRef({});
  const scheduler = useRef(null);
  const committedResources = useRef(new Map());
  const calendarSelection = useRef(0);
  const calendarDate = useRef(localIsoDate(localDateAtOffset()));
  const musicProviderRef = useRef(musicProviderId);
  const conversationSelection = useRef(0);
  musicProviderRef.current = musicProviderId;
  const activeProfile = profiles.find((profile) => profile.id === profileId) || profiles[0];

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem(profileStorageKey(THEME_KEY, profileId), appearance);
  }, [appearance, darkMode, profileId]);

  // Reduce transparency went with the glass shell; drop the per-profile key it left behind.
  useEffect(() => { window.localStorage.removeItem(profileStorageKey(TRANSPARENCY_KEY, profileId)); }, [profileId]);

  // The accent is a built theme chosen in <Theme> below; only the preset id is stored.
  useEffect(() => {
    window.localStorage.setItem(profileStorageKey(ACCENT_COLOR_KEY, profileId), accent.id);
  }, [accent, profileId]);

  useEffect(() => {
    window.localStorage.setItem(profileStorageKey(MUSIC_CONNECTION_KEY, profileId), JSON.stringify(musicIntegration));
  }, [musicIntegration, profileId]);

  // Save first and only then show the change, so a full localStorage can't leave unsaved state on screen (issue #29).
  const updateProfiles = (nextProfiles) => {
    try {
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles));
    } catch {
      notify("Profile changes couldn't be saved because this browser's storage for Live Desktop is full.", "error");
      return false;
    }
    setProfiles(nextProfiles);
    return true;
  };

  const switchProfile = (nextId) => {
    scheduler.current?.stop();
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, nextId);
    window.location.reload();
  };

  const deleteProfile = async (id) => {
    if (id === "default" || profiles.length === 1) return;
    try {
      await api("/api/profile/data", { method: "DELETE", profileId: id });
      for (const base of [MUSIC_CONNECTION_KEY, THEME_KEY, ACCENT_COLOR_KEY, TRANSPARENCY_KEY]) window.localStorage.removeItem(profileStorageKey(base, id));
      const next = profiles.filter((profile) => profile.id !== id);
      updateProfiles(next);
      switchProfile(next[0].id);
    } catch (error) { notify(error.message, "error"); }
  };

  const notify = useCallback((message, tone = "neutral") => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const refreshMusicPlayer = useCallback(async (announce = false) => {
    try {
      const latest = await scheduler.current?.refresh("media");
      if (!latest) return null;
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
      await scheduler.current?.refresh("phone", announce ? `/api/integrations/phone-link?refresh=${Date.now()}` : undefined);
      if (announce) notify("Phone Link information refreshed.", "success");
    } catch (error) {
      if (announce) notify(error.message, "error");
    } finally {
      setPhoneRefreshing(false);
    }
  }, [notify]);

  const refreshCalendar = useCallback(async (date, announce = false) => {
    const selection = ++calendarSelection.current;
    if (calendarDate.current !== date) await scheduler.current?.invalidate("calendar");
    if (selection !== calendarSelection.current) return;
    calendarDate.current = date;
    setCalendarRefreshing(true);
    try {
      await scheduler.current?.refresh("calendar", `/api/integrations/icloud-calendar?date=${date}${announce ? `&refresh=${Date.now()}` : ""}`);
      if (announce) notify("iCloud Calendar refreshed.", "success");
    } catch (error) {
      if (announce) notify(error.message, "error");
    } finally {
      if (selection === calendarSelection.current) setCalendarRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    resourceStates.current = {};
    committedResources.current.clear();
    setResourceStatus({});
    setSystemSeries([]);
    const resources = createResourceScheduler({
      read: async (path, signal) => {
        const resource = path.split("?")[0];
        const started = performance.now();
        recordTiming(resource, "request-start");
        try { return await api(path, { profileId, signal }); }
        finally { recordTiming(resource, "request-end", performance.now() - started); }
      },
      status: (key, value) => {
        const previous = resourceStates.current[key];
        const next = adaptResourceStatus(previous, value);
        resourceStates.current[key] = next;
        // Publish first success and meaningful errors; healthy polling uses data renders.
        if (Boolean(previous?.hasData) !== Boolean(next.hasData) || (previous?.error || null) !== (next.error || null)) {
          setResourceStatus(current => ({ ...current, [key]: next }));
        }
      },
    });
    scheduler.current = resources;
    const definitions = {
      health: { path: "/health", interval: 30000, apply: value => setHealth({ connected: true, configured: Boolean(value.assistantConfigured), provider: assistantProvider(value.provider).id }), error: () => setHealth(current => ({ ...current, connected: false, configured: false })) },
      system: {
        path: "/api/system",
        interval: 15000,
        apply: (value) => {
          setSystem(value);
          setSystemSeries((current) => [...current, systemSeriesSample(value)].slice(-SYSTEM_SERIES_CAP));
        },
      },
      apps: { path: "/api/system/apps", interval: 60000, apply: setApps },
      phone: { path: "/api/integrations/phone-link", interval: 10000, apply: setPhone, error: message => setPhone(current => ({ ...current, detail: message })) },
      actions: { path: "/api/actions", apply: setActions },
      memories: { path: "/api/memories", apply: setMemories },
      conversations: { path: "/api/conversations", apply: setConversations },
      runtime: { path: "/api/runtime", interval: 30000, apply: setRuntime },
      calendar: { path: () => `/api/integrations/icloud-calendar?date=${calendarDate.current}`, interval: 240000, apply: setCalendar, error: message => setCalendar(current => ({ ...current, status: "error", detail: message })) },
      settings: { path: "/api/profile/settings", apply: setAssistantSettings },
      conversation: { path: "/api/conversations", interval: 0, apply: setSelectedConversation },
      media: { path: () => `/api/integrations/media-session?provider=${musicProviderRef.current}`, interval: 5000, apply: value => setMusicPlayer(current => ({ ...current, ...value })) },
    };
    for (const [key, definition] of Object.entries(definitions)) resources.register(key, definition);
    const onVisibility = () => resources.visibilityChanged();
    document.addEventListener("visibilitychange", onVisibility);
    resources.visibilityChanged();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      resources.stop();
    };
  }, [profileId]);

  useEffect(() => {
    for (const [key, value] of Object.entries(resourceStates.current)) {
      if (!value.loading && !value.error && committedResources.current.get(key) !== value) {
        committedResources.current.set(key, value);
        recordTiming(key, "widget-commit", Math.max(0, performance.now() - value.readyAt));
      }
    }
  });

  useEffect(() => {
    const resources = scheduler.current;
    if (resources) resources.invalidate("media").then(() => resources.refresh("media")).catch(() => {});
  }, [musicProviderId]);

  const controls = useMemo(() => {
    const byId = new Map(system.controls.map((control) => [control.id, control]));
    return CONTROL_ORDER.map((id) => ({ ...CONTROL_META[id], available: false, enabled: false, detail: "System information unavailable", ...byId.get(id), id }));
  }, [system]);

  const pendingCount = actions.filter((action) => action.status === "pending").length;

  const queueControl = async (id) => {
    if (controlPending.current) return;
    controlPending.current = true;
    setPendingControl(id);
    try {
      await scheduler.current?.invalidate("system");
      await scheduler.current?.invalidate("actions");
      const control = controls.find((item) => item.id === id);
      const action = await api(`/api/system/controls/${id}`, {
        method: "POST",
        body: JSON.stringify({ enabled: !control?.enabled }),
      });
      await Promise.all(["system", "actions"].map(key => scheduler.current?.invalidate(key)));
      setActions((current) => upsertAction(current, action));
      setSystem((current) => applyCompletedControlAction(current, action));
      notify(
        action.status === "completed"
          ? (control?.direct
              ? `${CONTROL_META[id].label} changed.`
              : `${CONTROL_META[id].label} settings opened.`)
          : (control?.direct
              ? `${CONTROL_META[id].label} needs first-time approval.`
              : `${CONTROL_META[id].label} settings need first-time approval.`),
        "success",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      controlPending.current = false;
      setPendingControl(null);
    }
  };

  const openPhone = async () => {
    setPendingControl("phone");
    try {
      await scheduler.current?.invalidate("actions");
      const action = await api("/api/integrations/phone-link/open", { method: "POST" });
      await scheduler.current?.invalidate("actions");
      setActions((current) => upsertAction(current, action));
      notify(
        action.status === "completed"
          ? "Phone Link opened. The dashboard will stay open."
          : "Phone Link needs first-time approval. The dashboard will stay open.",
        "success",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setPendingControl(null);
    }
  };

  const openCalendarExternally = async () => {
    setPendingControl("calendar");
    try {
      await scheduler.current?.invalidate("actions");
      let usedWeb = false;
      let action;
      try {
        action = await api("/api/integrations/icloud-calendar/open", { method: "POST" });
      } catch (nativeError) {
        usedWeb = true;
        setPendingControl("calendar-web");
        notify(`${nativeError.message} Trying iCloud on the web…`, "error");
        action = await api("/api/integrations/icloud-calendar/open-web", { method: "POST" });
      }
      await scheduler.current?.invalidate("actions");
      setActions((current) => upsertAction(current, action));
      notify(
        action.status === "completed"
          ? (usedWeb
            ? "iCloud Calendar opened externally. The dashboard will stay open."
            : "Windows Calendar opened externally. The dashboard will stay open.")
          : (usedWeb
            ? "Opening iCloud Calendar externally needs first-time approval."
            : "Opening Windows Calendar externally needs first-time approval."),
        "success",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setPendingControl(null);
    }
  };

  const openMusicExternally = async () => {
    setPendingControl("music-external");
    try {
      await scheduler.current?.invalidate("actions");
      const action = await api(
        `/api/integrations/media-session/open-external?provider=${musicProviderId}`,
        { method: "POST" },
      );
      await scheduler.current?.invalidate("actions");
      setActions((current) => upsertAction(current, action));
      notify(
        action.status === "completed"
          ? `${musicProvider.name} opened externally. The dashboard will stay open.`
          : `Opening ${musicProvider.name} externally needs first-time approval.`,
        "success",
      );
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
      await scheduler.current?.invalidate("actions");
      await scheduler.current?.invalidate("system");
      const updated = await api(`/api/actions/${id}/${verb}`, { method: "POST" });
      await Promise.all(["actions", "system"].map(key => scheduler.current?.invalidate(key)));
      setActions((current) => upsertAction(current, updated));
      setSystem((current) => applyCompletedControlAction(current, updated));
      notify(verb === "approve" ? (updated.status === "completed" ? "Action completed." : "Action could not complete.") : "Action rejected.", updated.status === "failed" ? "error" : "success");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const createMemory = async (content, category) => {
    try {
      await scheduler.current?.invalidate("memories");
      await api("/api/memories", { method: "POST", body: JSON.stringify({ content, category }) });
      await scheduler.current?.invalidate("memories");
      notify("Memory saved locally.", "success");
      await scheduler.current?.refresh("memories").catch(error => {
        notify(`Memory saved, but the list could not refresh: ${error.message}`, "error");
      });
      return true;
    } catch (error) {
      notify(error.message, "error");
      return false;
    }
  };

  const deleteMemory = async (id) => {
    try {
      await scheduler.current?.invalidate("memories");
      await api(`/api/memories/${id}`, { method: "DELETE" });
      await scheduler.current?.invalidate("memories");
      notify("Memory forgotten.", "success");
      await scheduler.current?.refresh("memories");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const selectConversation = async (summary) => {
    const selection = ++conversationSelection.current;
    await scheduler.current?.invalidate("conversation");
    if (selection !== conversationSelection.current) return;
    if (!summary) {
      setSelectedConversation(null);
      return;
    }
    setSelectedConversation(null);
    try {
      await scheduler.current?.refresh("conversation", `/api/conversations/${summary.id}`);
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const sendMessage = async (message, conversationId = selectedConversation?.id) => {
    if (sendPending.current) return false;
    sendPending.current = true;
    setAssistantBusy(true);
    try {
      await Promise.all(["conversations", "actions", "memories", "conversation"].map(key => scheduler.current?.invalidate(key)));
      const result = await api("/api/chat", { method: "POST", body: JSON.stringify({ message, conversationId }) });
      await Promise.all(["conversations", "actions", "memories", "conversation"].map(key => scheduler.current?.invalidate(key)));
      setActiveView("conversations");
      await Promise.allSettled(["conversations", "actions", "memories"].map(key => scheduler.current?.refresh(key)));
      await selectConversation({ id: result.conversationId });
      return true;
    } catch (error) {
      notify(error.message, "error");
      return false;
    } finally {
      sendPending.current = false;
      setAssistantBusy(false);
    }
  };

  const connectICloudCalendar = async (email, appSpecificPassword) => {
    await scheduler.current?.invalidate("calendar");
    const connectedCalendar = await api("/api/integrations/icloud-calendar/connect", {
      method: "POST",
      body: JSON.stringify({ email, appSpecificPassword }),
    });
    await scheduler.current?.invalidate("calendar");
    setCalendar(connectedCalendar);
    notify("iCloud Calendar connected and synced.", "success");
  };

  const disconnectICloudCalendar = async () => {
    try {
      await scheduler.current?.invalidate("calendar");
      const disconnectedCalendar = await api("/api/integrations/icloud-calendar", { method: "DELETE" });
      await scheduler.current?.invalidate("calendar");
      setCalendar(disconnectedCalendar);
      notify("iCloud Calendar disconnected. Stored credentials were removed.", "success");
      return true;
    } catch (error) {
      notify(error.message, "error");
      return false;
    }
  };

  const controlMusic = async (action) => {
    try {
      if (!musicPlayer.available) {
        setActiveView("music");
        notify(`Start a track in the ${musicProvider.shortName} player once, then these controls will follow it through Windows.`, "neutral");
        return;
      }
      await scheduler.current?.invalidate("media");
      const updated = await api(`/api/integrations/media-session/${action}?provider=${musicProviderId}`, { method: "POST" });
      if (musicProviderRef.current !== musicProviderId) return;
      await scheduler.current?.invalidate("media");
      if (musicProviderRef.current !== musicProviderId) return;
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

  // Settings responses carry the whole assistant state, so one helper keeps health in step.
  const updateAssistantSettings = async (path, options) => {
    await scheduler.current?.invalidate("settings");
    await scheduler.current?.invalidate("health");
    const saved = await api(path, options);
    await Promise.all(["settings", "health"].map(key => scheduler.current?.invalidate(key)));
    setAssistantSettings(saved);
    setHealth((current) => ({ ...current, configured: Boolean(saved.assistantConfigured), provider: assistantProvider(saved.provider).id }));
    return saved;
  };

  const saveApiKey = async (providerId, apiKey) => {
    const provider = assistantProvider(providerId);
    await updateAssistantSettings(provider.keyRoute, { method: "POST", body: JSON.stringify({ apiKey }) });
    notify(`${provider.name} API key saved for this profile.`, "success");
  };

  const deleteApiKey = async (providerId) => {
    const provider = assistantProvider(providerId);
    await updateAssistantSettings(provider.keyRoute, { method: "DELETE" });
    notify(`This profile’s ${provider.name} API key was removed.`, "success");
  };

  const switchAssistantProvider = async (providerId) => {
    const provider = assistantProvider(providerId);
    if (provider.id === assistantSettings.provider) return;
    try {
      const saved = await updateAssistantSettings("/api/profile/assistant-provider", { method: "POST", body: JSON.stringify({ provider: provider.id }) });
      notify(`The assistant now uses ${providerModel(saved, provider.id)} from ${provider.name}.`, "success");
    } catch (error) { notify(error.message, "error"); }
  };

  const retry = async key => {
    resourceStates.current[key] = { ...resourceStates.current[key], manual: true, loading: true };
    setResourceStatus(current => ({ ...current, [key]: { ...resourceStates.current[key], loading: true } }));
    try { await scheduler.current?.refresh(key); } catch (error) { notify(error.message, 'error'); }
    finally { setResourceStatus(current => ({ ...current, [key]: resourceStates.current[key] })); }
  };
  const boundary = (key, name, children) => <ResourceBoundary name={name} status={resourceStates.current[key]} onRetry={() => retry(key)}>{children}</ResourceBoundary>;
  const servicesOnline = health.connected && runtime.frontendOnline;
  const headerActions = <HStack gap={2} vAlign="center" wrap="wrap">
    <HStack gap={2} vAlign="center" role="status">
      <StatusDot variant={servicesOnline ? "success" : "warning"} label={servicesOnline ? "Available" : "Unavailable"} />
      <Text color="secondary">{health.connected ? "Local mode · stored on this PC" : "Backend offline"}</Text>
    </HStack>
    <HStack gap={2} wrap="wrap" role="group" aria-label="Live Desktop services">
      <Button label="Restart Live Desktop" icon={<AstryxIcon icon={icons.Restart} />} isLoading={lifecycleState === "restarting"}
        isDisabled={lifecycleState !== "idle"} onClick={() => runLifecycle("restart")} />
      <Button label="Stop Live Desktop" variant="destructive" icon={<AstryxIcon icon={icons.Power} />}
        isDisabled={lifecycleState !== "idle"} onClick={() => setShutdownOpen(true)} />
    </HStack>
  </HStack>;
  const failedResources = Object.entries(resourceStatus).filter(([, value]) => value.error);
  const hostName = system.host?.name && system.host.name !== FALLBACK_SYSTEM.host.name ? system.host.name : "This PC";
  return (
    <Theme theme={themes[accent.theme] || themes[defaultThemeSlug]} mode={appearance}>
    <ToastViewport position="bottomEnd" maxVisible={3}>
    <AppShell
      banner={<LifecycleBanner state={lifecycleState} />}
      sideNav={<Navigation activeView={activeView} onNavigate={setActiveView} pendingCount={pendingCount} hostName={hostName} connected={health.connected}
        footer={<ProfileMenu profiles={profiles} activeProfile={activeProfile} onSwitch={switchProfile} onManage={() => setProfileMenuOpen(true)} />} />}>
      {failedResources.length ? <Banner status="warning" title="Some resources could not refresh" description="Last available data is retained."
        endContent={<HStack gap={2} wrap="wrap">{failedResources.map(([key]) => <Button key={key} size="sm" label={`Refresh ${key}`} isDisabled={resourceStatus[key].loading} onClick={() => retry(key)} />)}</HStack>} /> : null}
      {/* One column for every view plus the parked provider frame: its auto height lets each Page
          size to its content, so the Music frame sits right under the Music view. */}
      <VStack gap={0}>
        {activeView === "home" ? <HomeView system={system} systemSeries={systemSeries} health={health} controls={controls} pendingControl={pendingControl} onControl={queueControl} pendingCount={pendingCount} navigate={setActiveView} apps={apps} headerActions={headerActions}
          states={resourceStates.current} retry={retry} onSubmit={sendMessage} busy={assistantBusy}
          calendarProps={{ calendar, calendarRefreshing, onCalendarDateChange: date => refreshCalendar(date, false), onRefreshCalendar: date => refreshCalendar(date, true), onOpenCalendarSettings: () => setActiveView('settings'), onOpenCalendarExternally: openCalendarExternally }}
          phoneProps={{ phone, onOpen: openPhone, onRefresh: () => refreshPhone(true), onCopy: copyPhoneName, busy: pendingControl === 'phone', refreshing: phoneRefreshing }}
          mediaProps={{ musicProvider, musicPlayer, musicConfigured: Boolean(musicConnection.embedUrl), onOpenMusic: () => setActiveView('music'), onMusicAction: controlMusic, onOpenMusicExternally: openMusicExternally }} /> : null}

        {activeView === "system" ? boundary("system", "System", <SystemInfoView system={system} series={systemSeries} connected={health.connected} configured={health.configured} providerName={assistantProvider(health.provider).name} onCopy={copySystemInfo} headerActions={headerActions} />) : null}

        {activeView === "approvals" ? boundary("actions", "Approvals", <ApprovalsView actions={actions} onApprove={(id) => updateAction(id, "approve")} onReject={(id) => updateAction(id, "reject")} headerActions={headerActions} />) : null}
        {activeView === "memories" ? boundary("memories", "Memories", <MemoriesView memories={memories} onCreate={createMemory} onDelete={deleteMemory} headerActions={headerActions} />) : null}
        {activeView === "conversations" ? <ConversationsView conversations={conversations} selected={selectedConversation} onSelect={selectConversation} onSend={sendMessage} busy={assistantBusy} profileName={activeProfile.name} configured={health.configured} providerName={assistantProvider(health.provider).name} actions={actions} onApprove={(id) => updateAction(id, "approve")} onReject={(id) => updateAction(id, "reject")} headerActions={headerActions} /> : null}
        {activeView === "music" ? <MusicView musicProvider={musicProvider} musicProviderId={musicProviderId} onMusicProviderChange={switchMusicProvider} musicConnection={musicConnection} musicPlayer={musicPlayer} onMusicAction={controlMusic} onOpenMusicExternally={openMusicExternally} onOpenSettings={() => setActiveView("settings")} headerActions={headerActions} /> : null}
        {musicMounted && musicConnection.embedUrl ? <MusicFrame providerId={musicProviderId} provider={musicProvider} embedUrl={musicConnection.embedUrl} isActive={activeView === "music"} /> : null}
        {activeView === "settings" ? <SettingsView activeProfile={activeProfile} onManageProfiles={() => setProfileMenuOpen(true)} onOpenApprovals={() => setActiveView("approvals")} onRestart={() => runLifecycle("restart")} onShutdown={() => setShutdownOpen(true)} lifecycleBusy={lifecycleState !== "idle"} phone={phone} onOpenPhone={openPhone} headerActions={headerActions} appearance={appearance} onAppearanceChange={setAppearance} accentId={accent.id} onAccentChange={setAccentId} calendar={calendar} onConnectCalendar={connectICloudCalendar} onDisconnectCalendar={disconnectICloudCalendar} musicProviderId={musicProviderId} musicConnection={musicConnection} musicPlayer={musicPlayer} onMusicProviderChange={switchMusicProvider} onSaveMusic={saveMusicConnection} onDisconnectMusic={disconnectMusic} onRefreshMusic={() => refreshMusicPlayer(true)} onOpenMusic={() => setActiveView("music")} assistantSettings={assistantSettings} onAssistantProviderChange={switchAssistantProvider} onSaveApiKey={saveApiKey} onDeleteApiKey={deleteApiKey} /> : null}
      </VStack>
    </AppShell>
    <ProfileDialog isOpen={profileMenuOpen} onOpenChange={setProfileMenuOpen} profiles={profiles} activeProfile={activeProfile} onProfilesChange={updateProfiles} onSwitch={switchProfile}
      onError={(message) => notify(message, "error")}
      onDelete={(id) => { setProfileMenuOpen(false); setProfileDelete(profiles.find(profile => profile.id === id)); }} />
    <AlertDialog isOpen={shutdownOpen} onOpenChange={setShutdownOpen} title="Stop Live Desktop?" actionLabel="Stop services"
      description="This stops Live Desktop's frontend and backend services. It does not shut down Windows. Run start.cmd from the application folder to start them again; this page cannot restart stopped services."
      onAction={() => { setShutdownOpen(false); runLifecycle("shutdown"); }} />
    <AlertDialog isOpen={Boolean(profileDelete)} onOpenChange={open => { if (!open && !profileDeleting) setProfileDelete(null); }} title={`Delete ${profileDelete?.name ?? "profile"}?`} actionLabel="Delete profile data" isActionLoading={profileDeleting}
      description="This removes this profile's local conversations, memories, approvals, credentials and preferences. Other profiles are kept."
      onAction={async () => { setProfileDeleting(true); try { await deleteProfile(profileDelete.id); } finally { setProfileDeleting(false); setProfileDelete(null); } }} />
    <ToastBridge toast={toast} />
    </ToastViewport>
    </Theme>
  );
}
