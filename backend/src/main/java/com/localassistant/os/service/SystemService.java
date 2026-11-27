package com.localassistant.os.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import com.sun.management.OperatingSystemMXBean;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.net.NetworkInterface;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class SystemService {
    private static final Pattern kPercent = Pattern.compile("(?<![\\d.])(\\d{1,3})%");
    private static final Duration BATTERY_CACHE_TTL = Duration.ofMinutes(5);
    static final Duration BATTERY_RETRY_AFTER = Duration.ofSeconds(30);
    // Bridge results never change while the process runs, so a successful read is kept forever.
    // A failed read (e.g. the bridge is still starting at boot) is retried after this delay.
    static final Duration WINDOWS_DETAILS_RETRY_AFTER = Duration.ofSeconds(30);
    private static final Map<String, ControlDefinition> CONTROL_DEFINITIONS = Map.of(
            "wifi", new ControlDefinition("wifi", "Wi-Fi", "ms-settings:network-wifi", true),
            "bluetooth", new ControlDefinition("bluetooth", "Bluetooth", "ms-settings:bluetooth", true),
            "focus", new ControlDefinition("focus", "Focus", "ms-settings:quiethours", false),
            "night-light", new ControlDefinition("night-light", "Night light", "ms-settings:nightlight", false),
            "microphone", new ControlDefinition("microphone", "Mic privacy", "ms-settings:privacy-microphone", false),
            "battery-saver", new ControlDefinition("battery-saver", "Battery saver", "ms-settings:batterysaver", false));

    private static final Map<String, AppDefinition> KNOWN_APPS = Map.ofEntries(
            Map.entry("code", new AppDefinition("Visual Studio Code", "Working in your local workspace", "code")),
            Map.entry("figma", new AppDefinition("Figma", "Design workspace", "figma")),
            Map.entry("msedge", new AppDefinition("Microsoft Edge", "Browser active", "edge")),
            Map.entry("chrome", new AppDefinition("Google Chrome", "Browser active", "chrome")),
            Map.entry("excel", new AppDefinition("Microsoft Excel", "Spreadsheet active", "excel")),
            Map.entry("powerpnt", new AppDefinition("Microsoft PowerPoint", "Presentation active", "powerpoint")),
            Map.entry("applemusic", new AppDefinition("Apple Music", "Audio app active", "apple-music")),
            Map.entry("slack", new AppDefinition("Slack", "Workspace active", "slack")),
            Map.entry("teams", new AppDefinition("Microsoft Teams", "Collaboration active", "teams")));

    private final Path workspaceRoot;
    private final WindowsSystemControlService systemControls;
    private final WindowsBridgeClient bridge;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // Bridge calls block on the native helper. They run on this small dedicated pool, not the
    // common ForkJoinPool, so a slow bridge can't starve parallel streams or other async work.
    static final int BRIDGE_THREADS = 4;
    private static final int BRIDGE_QUEUE = 32;
    private final ThreadPoolExecutor bridgeExecutor = newBridgeExecutor();
    private static final Duration IO_RATE_MIN_ELAPSED = Duration.ofSeconds(1);
    private static final Duration IO_RATE_MAX_ELAPSED = Duration.ofMinutes(5);
    // How long a computed rate may be handed to another caller who samples too soon to get its own.
    static final Duration IO_RATE_SHARE_FOR = Duration.ofSeconds(5);

    private final Object batteryLock = new Object();
    private final PhoneMetadataCache phoneMetadata = new PhoneMetadataCache();
    private volatile CachedWindowsDetails cachedWindowsDetails;
    // Package-private so tests can move time forward; production always uses the system clock.
    Clock clock = Clock.systemUTC();
    private volatile CachedBattery cachedBattery;
    private final IoRateTracker ioRateTracker = new IoRateTracker();

    public SystemService(AssistantProperties properties, WindowsSystemControlService systemControls) {
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        this.systemControls = systemControls;
        this.bridge = systemControls.bridge();
    }

    @PostConstruct
    void warmStableSystemData() {
        if (!isWindows()) {
            return;
        }
        CompletableFuture.runAsync(this::batteryInfo, bridgeExecutor);
        CompletableFuture.runAsync(() -> {
            OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
            windowsDetails(Math.max(0, osBean.getTotalMemorySize()));
        }, bridgeExecutor);
    }

    @PreDestroy
    void shutdownBridgeExecutor() {
        bridgeExecutor.shutdownNow();
    }

    private static ThreadPoolExecutor newBridgeExecutor() {
        AtomicInteger count = new AtomicInteger();
        ThreadPoolExecutor executor = new ThreadPoolExecutor(
                BRIDGE_THREADS,
                BRIDGE_THREADS,
                30,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(BRIDGE_QUEUE),
                runnable -> {
                    Thread thread = new Thread(runnable, "system-bridge-" + count.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                },
                // When the pool and queue are full (or the pool is shutting down), run the task on the
                // caller's thread. Unlike CallerRunsPolicy this never discards a task, so a join() on
                // its future can't hang.
                (runnable, pool) -> runnable.run());
        executor.allowCoreThreadTimeOut(true);
        return executor;
    }

    public SystemSnapshot snapshot() {
        CompletableFuture<BatteryInfo> battery = CompletableFuture.supplyAsync(this::batteryInfo, bridgeExecutor);
        CompletableFuture<List<SystemControl>> controls = CompletableFuture.supplyAsync(this::controls, bridgeExecutor);
        CompletableFuture<IoRates> ioRates = CompletableFuture.supplyAsync(this::ioRates, bridgeExecutor);
        OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        long totalMemory = Math.max(0, osBean.getTotalMemorySize());
        long freeMemory = Math.max(0, osBean.getFreeMemorySize());
        double cpuLoad = Math.max(0, osBean.getCpuLoad());
        File disk = Optional.ofNullable(workspaceRoot.toFile().toPath().getRoot())
                .map(Path::toFile)
                .orElse(workspaceRoot.toFile());
        NetworkInfo baseNetwork = networkInfo();
        WindowsDetails windowsDetails = windowsDetails(totalMemory);
        IoRates rates = ioRates.join();
        NetworkInfo network = new NetworkInfo(
                baseNetwork.name(),
                baseNetwork.address(),
                baseNetwork.connected(),
                rates.rxBytesPerSec(),
                rates.txBytesPerSec(),
                rates.networkAvailable());

        return new SystemSnapshot(
                Instant.now().toString(),
                new HostInfo(
                        environment("COMPUTERNAME", "This device"),
                        System.getProperty("user.name", "Local user"),
                        System.getProperty("os.name", "Windows"),
                        System.getProperty("os.version", "Unknown"),
                        System.getProperty("os.arch", "Unknown"),
                        Runtime.version().feature()),
                new ResourceInfo(
                        Math.round(cpuLoad * 100),
                        totalMemory - freeMemory,
                        totalMemory,
                        Math.max(0, disk.getTotalSpace() - disk.getUsableSpace()),
                        Math.max(0, disk.getTotalSpace()),
                        network,
                        battery.join(),
                        rates.diskActivity()),
                controls.join(),
                windowsDetails.device(),
                windowsDetails.windows());
    }

    private WindowsDetails windowsDetails(long fallbackMemoryBytes) {
        CachedWindowsDetails current = cachedWindowsDetails;
        if (current != null && current.isFresh(clock.instant())) {
            return current.value();
        }
        synchronized (this) {
            current = cachedWindowsDetails;
            Instant now = clock.instant();
            if (current == null || !current.isFresh(now)) {
                current = readWindowsDetails(fallbackMemoryBytes, now);
                cachedWindowsDetails = current;
            }
            return current.value();
        }
    }

    private CachedWindowsDetails readWindowsDetails(long fallbackMemoryBytes, Instant now) {
        WindowsDetails fallback = fallbackWindowsDetails(fallbackMemoryBytes);
        if (!isWindows()) {
            return CachedWindowsDetails.permanent(fallback);
        }
        CachedWindowsDetails retryLater = CachedWindowsDetails.until(fallback, now.plus(WINDOWS_DETAILS_RETRY_AFTER));
        try {
            Map<String, Object> result = bridge.request("system.staticSnapshot", Map.of());
            if (!result.containsKey("device")) return retryLater;
            JsonNode root = objectMapper.valueToTree(result);
            JsonNode device = root.path("device");
            JsonNode windows = root.path("windows");
            List<GraphicsInfo> graphics = new java.util.ArrayList<>();
            windowsArray(device.path("graphics")).forEach(item -> graphics.add(new GraphicsInfo(
                    text(item, "name", "Unknown graphics adapter"),
                    text(item, "driverVersion", "Unavailable"))));
            DeviceInfo deviceInfo = new DeviceInfo(
                    text(device, "manufacturer", fallback.device().manufacturer()),
                    text(device, "model", fallback.device().model()),
                    text(device, "processorName", fallback.device().processorName()),
                    integer(device, "processorCores", fallback.device().processorCores()),
                    integer(device, "processorLogicalProcessors", fallback.device().processorLogicalProcessors()),
                    integer(device, "maxClockMhz", fallback.device().maxClockMhz()),
                    longValue(device, "installedMemoryBytes", fallback.device().installedMemoryBytes()),
                    graphics.isEmpty() ? fallback.device().graphics() : List.copyOf(graphics),
                    text(device, "systemType", fallback.device().systemType()),
                    text(device, "productId", "Unavailable"),
                    text(device, "deviceId", "Unavailable"));
            WindowsInfo windowsInfo = new WindowsInfo(
                    text(windows, "edition", fallback.windows().edition()),
                    text(windows, "version", "Unavailable"),
                    text(windows, "osVersion", fallback.windows().osVersion()),
                    text(windows, "build", fallback.windows().build()),
                    text(windows, "installedOn", "Unavailable"),
                    text(windows, "architecture", fallback.windows().architecture()));
            return CachedWindowsDetails.permanent(new WindowsDetails(deviceInfo, windowsInfo));
        } catch (Exception ignored) {
            return retryLater;
        }
    }

    private WindowsDetails fallbackWindowsDetails(long memoryBytes) {
        String architecture = System.getProperty("os.arch", "Unknown");
        DeviceInfo device = new DeviceInfo(
                "Unavailable",
                "Unavailable",
                environment("PROCESSOR_IDENTIFIER", "Unavailable"),
                Runtime.getRuntime().availableProcessors(),
                Runtime.getRuntime().availableProcessors(),
                0,
                memoryBytes,
                List.of(),
                architecture,
                "Unavailable",
                "Unavailable");
        WindowsInfo windows = new WindowsInfo(
                System.getProperty("os.name", "Windows"),
                "Unavailable",
                System.getProperty("os.version", "Unknown"),
                System.getProperty("os.version", "Unknown"),
                "Unavailable",
                architecture);
        return new WindowsDetails(device, windows);
    }

    private List<JsonNode> windowsArray(JsonNode node) {
        if (node.isArray()) {
            java.util.ArrayList<JsonNode> values = new java.util.ArrayList<>();
            node.forEach(values::add);
            return values;
        }
        return node.isObject() ? List.of(node) : List.of();
    }

    private String text(JsonNode node, String field, String fallback) {
        String value = node.path(field).asText("").trim();
        return value.isBlank() ? fallback : value;
    }

    private int integer(JsonNode node, String field, int fallback) {
        int value = node.path(field).asInt(0);
        return value > 0 ? value : fallback;
    }

    private long longValue(JsonNode node, String field, long fallback) {
        long value = node.path(field).asLong(0);
        return value > 0 ? value : fallback;
    }

    public List<RunningApp> runningApps() {
        Map<String, RunningApp> found = new LinkedHashMap<>();
        JsonNode processes = objectMapper.valueToTree(bridge.request("process.knownApps", Map.of()).getOrDefault("processes", List.of()));
        for (JsonNode process : processes) {
            String key = process.asText("");
            AppDefinition definition = KNOWN_APPS.get(key);
            if (definition != null) found.putIfAbsent(key,
                    new RunningApp(key, definition.name(), definition.detail(), definition.icon(), true));
        }
        return found.values().stream()
                .sorted(Comparator.comparing(RunningApp::name))
                .limit(6)
                .toList();
    }

    public PhoneLinkInfo phoneLink() {
        return phoneLink(false);
    }

    public PhoneLinkInfo phoneLink(boolean refresh) {
        boolean windows = isWindows();
        Path packagePath = Path.of(environment("LOCALAPPDATA", "."), "Packages", "Microsoft.YourPhone_8wekyb3d8bbwe");
        Map<String, Object> phoneState = windows ? bridge.request("phoneLink.snapshot", Map.of("refresh", refresh)) : Map.of();
        boolean installed = Boolean.TRUE.equals(phoneState.get("phoneLinkInstalled"));
        boolean running = Boolean.TRUE.equals(phoneState.get("phoneLinkRunning"));

        Path metadataPath = packagePath.resolve("LocalCache").resolve("DeviceMetadataStorage.json");
        Path companionPath = packagePath.resolve("LocalState").resolve("StartMenu").resolve("StartMenuCompanion.json");
        Optional<PhoneDevice> device = installed ? readPhoneDevice(metadataPath, refresh) : Optional.empty();
        JsonNode companion = installed ? phoneMetadata.read(companionPath, refresh) : objectMapper.createObjectNode();
        Instant companionUpdatedAt = modifiedAt(companionPath).orElse(null);
        Instant metadataUpdatedAt = modifiedAt(metadataPath).orElse(null);
        Instant lastSeenAt = device.map(PhoneDevice::lastSeenAt).orElse(null);
        Instant lastSyncedAt = latest(companionUpdatedAt, metadataUpdatedAt, lastSeenAt);
        boolean connected = running
                && companionUpdatedAt != null
                && companionUpdatedAt.isAfter(Instant.now().minusSeconds(10 * 60));
        Integer batteryPercent = readBatteryPercent(companion).orElse(null);
        String companionText = companion.toString().toLowerCase(Locale.ROOT);
        boolean notificationsAvailable = companionText.contains("new messages are available") || companionText.contains("notification");
        String detail = !installed
                ? "Phone Link is not installed"
                : connected
                        ? "Connected through Phone Link"
                        : running ? "Phone Link is running" : "Ready to open";

        return new PhoneLinkInfo(
                installed,
                running,
                connected,
                device.map(PhoneDevice::displayName).orElse("Linked phone"),
                device.map(PhoneDevice::manufacturer).orElse("Unknown"),
                device.map(PhoneDevice::model).orElse("Unknown"),
                device.map(PhoneDevice::osName).orElse("Phone"),
                batteryPercent,
                notificationsAvailable,
                lastSeenAt == null ? null : lastSeenAt.toString(),
                lastSyncedAt == null ? null : lastSyncedAt.toString(),
                Instant.now().toString(),
                detail,
                "ms-phone:");
    }

    private Optional<PhoneDevice> readPhoneDevice(Path metadataPath, boolean refresh) {
        if (!Files.isRegularFile(metadataPath)) {
            return Optional.empty();
        }
        try {
            JsonNode root = phoneMetadata.read(metadataPath, refresh);
            JsonNode deviceGroups = root.path("DeviceMetadatas");
            PhoneDevice newest = null;
            Iterator<Map.Entry<String, JsonNode>> groups = deviceGroups.fields();
            while (groups.hasNext()) {
                JsonNode candidates = groups.next().getValue();
                if (!candidates.isArray()) {
                    continue;
                }
                for (JsonNode candidate : candidates) {
                    if (!candidate.path("IsLinked").asBoolean(false)) {
                        continue;
                    }
                    JsonNode envelope = candidate.path("Metadata");
                    JsonNode metadata = envelope.path("Metadata");
                    String osName = metadata.path("OsName").asText("");
                    if (osName.equalsIgnoreCase("Windows")) {
                        continue;
                    }
                    Instant lastSeen = parseInstant(envelope.path("LastSeenTime").asText(null));
                    PhoneDevice current = new PhoneDevice(
                            metadata.path("DisplayName").asText("Linked phone"),
                            metadata.path("Manufacture").asText("Unknown"),
                            metadata.path("ModelName").asText("Unknown"),
                            osName.isBlank() ? "Phone" : osName,
                            lastSeen);
                    if (newest == null || current.lastSeenAt().isAfter(newest.lastSeenAt())) {
                        newest = current;
                    }
                }
            }
            return Optional.ofNullable(newest);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private Optional<Integer> readBatteryPercent(JsonNode root) {
        return batteryPercent(root);
    }

    /**
     * Phone Link writes an Adaptive Card, not a data record. The phone's battery is the only
     * Container whose tooltip names a percentage ("Battery 78% remaining") and whose child
     * TextBlock shows that same percentage. Anything under a notification "preview" is message
     * text and is never read, so a "50%" in a message cannot pass as the battery level.
     * Returns empty (shown as unavailable) when the card has no such container.
     */
    static Optional<Integer> batteryPercent(JsonNode root) {
        try {
            ArrayDeque<JsonNode> queue = new ArrayDeque<>();
            queue.add(root);
            while (!queue.isEmpty()) {
                JsonNode current = queue.removeFirst();
                if (current.isObject()) {
                    Matcher tooltip = kPercent.matcher(current.path("tooltip").asText(""));
                    if (tooltip.find()) {
                        for (JsonNode child : current.path("items")) {
                            String text = child.path("text").asText("").trim();
                            if (text.equals(tooltip.group(1) + "%") && Integer.parseInt(tooltip.group(1)) <= 100) {
                                return Optional.of(Integer.parseInt(tooltip.group(1)));
                            }
                        }
                    }
                    current.properties().forEach(entry -> {
                        if (!"preview".equalsIgnoreCase(entry.getKey())) queue.addLast(entry.getValue());
                    });
                } else if (current.isArray()) {
                    current.elements().forEachRemaining(queue::addLast);
                }
            }
        } catch (Exception ignored) {
            // Phone Link may replace the companion file while it is being read.
        }
        return Optional.empty();
    }

    private Optional<Instant> modifiedAt(Path path) {
        try {
            return Files.isRegularFile(path) ? Optional.of(Files.getLastModifiedTime(path).toInstant()) : Optional.empty();
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private Instant latest(Instant... values) {
        Instant latest = null;
        for (Instant value : values) {
            if (value != null && (latest == null || value.isAfter(latest))) {
                latest = value;
            }
        }
        return latest;
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return Instant.EPOCH;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ignored) {
            try {
                return Instant.parse(value);
            } catch (DateTimeParseException ignoredAgain) {
                return Instant.EPOCH;
            }
        }
    }

    public ControlDefinition control(String id) {
        ControlDefinition definition = CONTROL_DEFINITIONS.get(id);
        if (definition == null) {
            throw new IllegalArgumentException("Unknown system control.");
        }
        if (!isWindows()) {
            throw new IllegalStateException("System controls are available on Windows only.");
        }
        return definition;
    }

    private List<SystemControl> controls() {
        boolean windows = isWindows();
        Map<String, Object> directSnapshot = windows ? systemControls.snapshot() : Map.of();
        return CONTROL_DEFINITIONS.values().stream()
                .sorted(Comparator.comparing(ControlDefinition::id))
                .map(definition -> {
                    Map<?, ?> state = directState(directSnapshot, definition.id());
                    boolean directAvailable = definition.direct() && Boolean.TRUE.equals(state.get("available"));
                    boolean enabled = directAvailable && Boolean.TRUE.equals(state.get("enabled"));
                    String detail = !windows
                            ? "Windows only"
                            : directAvailable
                                    ? (enabled ? "On" : "Off")
                                    : definition.direct()
                                            ? "Direct control unavailable"
                                            : "Opens Windows Settings after one-time approval";
                    return new SystemControl(
                            definition.id(),
                            definition.label(),
                            enabled,
                            definition.direct() ? directAvailable : windows,
                            detail,
                            definition.direct());
                })
                .toList();
    }

    private Map<?, ?> directState(Map<String, Object> snapshot, String id) {
        Object value = snapshot.get(id);
        return value instanceof Map<?, ?> map ? map : Map.of();
    }

    private NetworkInfo networkInfo() {
        try {
            return NetworkInterface.networkInterfaces()
                    .filter(item -> {
                        try {
                            String name = (item.getName() + " " + item.getDisplayName()).toLowerCase(Locale.ROOT);
                            return item.isUp()
                                    && !item.isLoopback()
                                    && !item.isVirtual()
                                    && !name.contains("miniport")
                                    && !name.contains("wfp")
                                    && !name.contains("lightweight filter")
                                    && !name.contains("tunnel")
                                    && item.inetAddresses().anyMatch(address ->
                                            address instanceof java.net.Inet4Address
                                                    && !address.isLoopbackAddress()
                                                    && !address.isLinkLocalAddress());
                        } catch (Exception ignored) {
                            return false;
                        }
                    })
                    .sorted(Comparator.comparingInt(this::networkPriority))
                    .findFirst()
                    .map(item -> {
                        String address = item.inetAddresses()
                                .filter(candidate -> candidate instanceof java.net.Inet4Address)
                                .findFirst()
                                .map(java.net.InetAddress::getHostAddress)
                                .orElse("Connected");
                        String rawName = (item.getName() + " " + item.getDisplayName()).toLowerCase(Locale.ROOT);
                        String label = rawName.contains("wi-fi") || rawName.contains("wifi")
                                        || rawName.contains("wlan") || rawName.contains("wireless")
                                ? "Wi-Fi"
                                : item.getName();
                        return new NetworkInfo(label, address, true, null, null, false);
                    })
                    .orElseGet(() -> new NetworkInfo("No active network", "Offline", false, null, null, false));
        } catch (Exception ignored) {
            // Return the explicit offline state below.
        }
        return new NetworkInfo("No active network", "Offline", false, null, null, false);
    }

    private IoRates ioRates() {
        if (!isWindows()) {
            return IoRates.unavailable();
        }
        try {
            Map<String, Object> result = bridge.request("system.ioCounters", Map.of());
            JsonNode root = objectMapper.valueToTree(result);
            long networkIn = longValue(root, "networkInBytes", -1);
            long networkOut = longValue(root, "networkOutBytes", -1);
            long diskRead = longValue(root, "diskReadBytes", -1);
            long diskWrite = longValue(root, "diskWriteBytes", -1);
            boolean diskAvailable = Boolean.TRUE.equals(result.get("diskAvailable"));
            if (networkIn < 0 || networkOut < 0) {
                return IoRates.unavailable();
            }
            Instant now = Instant.now();
            IoCounterSample current = new IoCounterSample(now, networkIn, networkOut, diskRead, diskWrite, diskAvailable);
            return ioRateTracker.next(current);
        } catch (Exception ignored) {
            return IoRates.unavailable();
        }
    }

    /**
     * Turns cumulative counter samples from every caller (dashboard windows, the agent) into rates.
     * The baseline only moves forward once a sample is at least {@link #IO_RATE_MIN_ELAPSED} past it,
     * and a caller that samples sooner gets the most recent computed rates. Before, each call replaced
     * one shared baseline, so two pollers less than a second apart made each other read "unavailable".
     */
    static final class IoRateTracker {
        private IoCounterSample baseline;
        private IoRates lastRates;
        private Instant lastRatesAt;

        synchronized IoRates next(IoCounterSample current) {
            if (baseline == null) {
                baseline = current;
                return IoRates.unavailable();
            }
            Duration sinceBaseline = Duration.between(baseline.capturedAt(), current.capturedAt());
            if (sinceBaseline.compareTo(IO_RATE_MIN_ELAPSED) < 0) {
                // Too close to the last sample to measure; keep the baseline and share the last result.
                if (lastRates != null
                        && Duration.between(lastRatesAt, current.capturedAt()).compareTo(IO_RATE_SHARE_FOR) <= 0) {
                    return lastRates;
                }
                return IoRates.unavailable();
            }
            IoRates rates = computeIoRates(baseline, current);
            baseline = current;
            boolean anyAvailable = rates.networkAvailable() || rates.diskActivity().available();
            lastRates = anyAvailable ? rates : null;
            lastRatesAt = current.capturedAt();
            return rates;
        }
    }

    static IoRates computeIoRates(IoCounterSample previous, IoCounterSample current) {
        Duration elapsed = Duration.between(previous.capturedAt(), current.capturedAt());
        if (elapsed.compareTo(IO_RATE_MIN_ELAPSED) < 0 || elapsed.compareTo(IO_RATE_MAX_ELAPSED) > 0) {
            return IoRates.unavailable();
        }
        double seconds = Math.max(elapsed.toMillis() / 1000.0, 0.001);
        Long rx = rateOrNull(previous.networkInBytes(), current.networkInBytes(), seconds);
        Long tx = rateOrNull(previous.networkOutBytes(), current.networkOutBytes(), seconds);
        boolean networkAvailable = rx != null && tx != null;
        Long diskRead = null;
        Long diskWrite = null;
        boolean diskAvailable = false;
        if (previous.diskAvailable() && current.diskAvailable()
                && previous.diskReadBytes() >= 0 && current.diskReadBytes() >= 0
                && previous.diskWriteBytes() >= 0 && current.diskWriteBytes() >= 0) {
            diskRead = rateOrNull(previous.diskReadBytes(), current.diskReadBytes(), seconds);
            diskWrite = rateOrNull(previous.diskWriteBytes(), current.diskWriteBytes(), seconds);
            diskAvailable = diskRead != null && diskWrite != null;
        }
        return new IoRates(
                networkAvailable ? rx : null,
                networkAvailable ? tx : null,
                networkAvailable,
                new DiskActivityInfo(
                        diskAvailable,
                        diskAvailable ? diskRead : null,
                        diskAvailable ? diskWrite : null));
    }

    private static Long rateOrNull(long previous, long current, double seconds) {
        if (current < previous) {
            return null;
        }
        return Math.round((current - previous) / seconds);
    }

    private int networkPriority(NetworkInterface item) {
        String name = (item.getName() + " " + item.getDisplayName()).toLowerCase(Locale.ROOT);
        if (name.contains("wi-fi") || name.contains("wifi") || name.contains("wlan") || name.contains("wireless")) {
            return 0;
        }
        if (name.contains("ethernet")) {
            return 1;
        }
        return 2;
    }

    private BatteryInfo batteryInfo() {
        CachedBattery current = cachedBattery;
        Instant now = clock.instant();
        if (current != null && now.isBefore(current.expiresAt())) {
            return current.value();
        }
        synchronized (batteryLock) {
            current = cachedBattery;
            now = clock.instant();
            if (current != null && now.isBefore(current.expiresAt())) {
                return current.value();
            }
            current = readBatteryInfo(now);
            cachedBattery = current;
            return current.value();
        }
    }

    private CachedBattery readBatteryInfo(Instant now) {
        if (!isWindows()) return new CachedBattery(new BatteryInfo(false, null, "Unavailable"), now.plus(BATTERY_CACHE_TTL));
        Map<String, Object> result = bridge.request("power.snapshot", Map.of());
        boolean available = Boolean.TRUE.equals(result.get("available"));
        Object percent = result.get("percent");
        BatteryInfo value = new BatteryInfo(available, percent instanceof Number number ? number.intValue() : null,
                String.valueOf(result.getOrDefault("detail", "Unavailable")));
        // A real reading always carries a "percent" key (null on a desktop). A bridge that is still
        // starting, busy or failed answers without one; retry that soon instead of pinning it for minutes.
        Duration keepFor = result.containsKey("percent") ? BATTERY_CACHE_TTL : BATTERY_RETRY_AFTER;
        return new CachedBattery(value, now.plus(keepFor));
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("windows");
    }

    private String environment(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    public record SystemSnapshot(
            String capturedAt,
            HostInfo host,
            ResourceInfo resources,
            List<SystemControl> controls,
            DeviceInfo device,
            WindowsInfo windows) {}

    public record HostInfo(String name, String user, String os, String osVersion, String architecture, int javaVersion) {}

    public record ResourceInfo(
            long cpuPercent,
            long memoryUsedBytes,
            long memoryTotalBytes,
            long storageUsedBytes,
            long storageTotalBytes,
            NetworkInfo network,
            BatteryInfo battery,
            DiskActivityInfo diskActivity) {}

    public record NetworkInfo(
            String name,
            String address,
            boolean connected,
            Long rxBytesPerSec,
            Long txBytesPerSec,
            boolean ratesAvailable) {}

    public record DiskActivityInfo(boolean available, Long readBytesPerSec, Long writeBytesPerSec) {}

    public record BatteryInfo(boolean available, Integer percent, String detail) {}

    record IoCounterSample(
            Instant capturedAt,
            long networkInBytes,
            long networkOutBytes,
            long diskReadBytes,
            long diskWriteBytes,
            boolean diskAvailable) {}

    record IoRates(
            Long rxBytesPerSec,
            Long txBytesPerSec,
            boolean networkAvailable,
            DiskActivityInfo diskActivity) {
        static IoRates unavailable() {
            return new IoRates(null, null, false, new DiskActivityInfo(false, null, null));
        }
    }

    public record DeviceInfo(
            String manufacturer,
            String model,
            String processorName,
            int processorCores,
            int processorLogicalProcessors,
            int maxClockMhz,
            long installedMemoryBytes,
            List<GraphicsInfo> graphics,
            String systemType,
            String productId,
            String deviceId) {}

    public record GraphicsInfo(String name, String driverVersion) {}

    public record WindowsInfo(
            String edition,
            String version,
            String osVersion,
            String build,
            String installedOn,
            String architecture) {}

    public record SystemControl(
            String id, String label, boolean enabled, boolean available, String detail, boolean direct) {}

    public record ControlDefinition(String id, String label, String settingsUri, boolean direct) {}
    private record CachedBattery(BatteryInfo value, Instant expiresAt) {}

    public record RunningApp(String id, String name, String detail, String icon, boolean running) {}

    public record PhoneLinkInfo(
            boolean installed,
            boolean running,
            boolean connected,
            String deviceName,
            String manufacturer,
            String model,
            String osName,
            Integer batteryPercent,
            boolean notificationsAvailable,
            String lastSeenAt,
            String lastSyncedAt,
            String capturedAt,
            String detail,
            String uri) {}

    private record AppDefinition(String name, String detail, String icon) {}

    private record PhoneDevice(String displayName, String manufacturer, String model, String osName, Instant lastSeenAt) {}

    private record WindowsDetails(DeviceInfo device, WindowsInfo windows) {}

    /** {@code expiresAt == null} means the value never expires. */
    private record CachedWindowsDetails(WindowsDetails value, Instant expiresAt) {
        static CachedWindowsDetails permanent(WindowsDetails value) {
            return new CachedWindowsDetails(value, null);
        }

        static CachedWindowsDetails until(WindowsDetails value, Instant expiresAt) {
            return new CachedWindowsDetails(value, expiresAt);
        }

        boolean isFresh(Instant now) {
            return expiresAt == null || now.isBefore(expiresAt);
        }
    }
}
