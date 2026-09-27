package com.localassistant.os.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import com.sun.management.OperatingSystemMXBean;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.net.NetworkInterface;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

@Service
public class SystemService {
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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private volatile WindowsDetails cachedWindowsDetails;

    public SystemService(AssistantProperties properties, WindowsSystemControlService systemControls) {
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        this.systemControls = systemControls;
    }

    public SystemSnapshot snapshot() {
        OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        long totalMemory = Math.max(0, osBean.getTotalMemorySize());
        long freeMemory = Math.max(0, osBean.getFreeMemorySize());
        double cpuLoad = Math.max(0, osBean.getCpuLoad());
        File disk = Optional.ofNullable(workspaceRoot.toFile().toPath().getRoot())
                .map(Path::toFile)
                .orElse(workspaceRoot.toFile());
        NetworkInfo network = networkInfo();
        WindowsDetails windowsDetails = windowsDetails(totalMemory);

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
                        batteryInfo()),
                controls(),
                windowsDetails.device(),
                windowsDetails.windows());
    }

    private WindowsDetails windowsDetails(long fallbackMemoryBytes) {
        WindowsDetails current = cachedWindowsDetails;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (cachedWindowsDetails == null) {
                cachedWindowsDetails = readWindowsDetails(fallbackMemoryBytes);
            }
            return cachedWindowsDetails;
        }
    }

    private WindowsDetails readWindowsDetails(long fallbackMemoryBytes) {
        WindowsDetails fallback = fallbackWindowsDetails(fallbackMemoryBytes);
        if (!isWindows()) {
            return fallback;
        }
        String script = """
                $ErrorActionPreference='SilentlyContinue'
                $computer=Get-CimInstance Win32_ComputerSystem
                $processor=Get-CimInstance Win32_Processor | Select-Object -First 1
                $graphics=@(Get-CimInstance Win32_VideoController | Where-Object {$_.Name} | ForEach-Object {
                  [pscustomobject]@{name=[string]$_.Name;driverVersion=[string]$_.DriverVersion}
                })
                $os=Get-CimInstance Win32_OperatingSystem
                $currentVersion=Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
                $sqm=Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\SQMClient'
                [pscustomobject]@{
                  device=[pscustomobject]@{
                    manufacturer=[string]$computer.Manufacturer
                    model=[string]$computer.Model
                    processorName=[string]$processor.Name
                    processorCores=[int]$processor.NumberOfCores
                    processorLogicalProcessors=[int]$processor.NumberOfLogicalProcessors
                    maxClockMhz=[int]$processor.MaxClockSpeed
                    installedMemoryBytes=[long]$computer.TotalPhysicalMemory
                    graphics=$graphics
                    systemType=[string]$computer.SystemType
                    productId=[string]$currentVersion.ProductId
                    deviceId=[string]$sqm.MachineId
                  }
                  windows=[pscustomobject]@{
                    edition=[string]$os.Caption
                    version=[string]$currentVersion.DisplayVersion
                    osVersion=[string]$os.Version
                    build=(([string]$os.BuildNumber)+'.'+([string]$currentVersion.UBR))
                    installedOn=if($os.InstallDate){$os.InstallDate.ToUniversalTime().ToString('o')}else{''}
                    architecture=[string]$os.OSArchitecture
                  }
                } | ConvertTo-Json -Depth 5 -Compress
                """;
        try {
            Process process = new ProcessBuilder(
                    "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
                    .redirectErrorStream(true)
                    .start();
            if (!process.waitFor(8, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return fallback;
            }
            String output = new String(process.getInputStream().readAllBytes()).trim();
            JsonNode root = objectMapper.readTree(output);
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
            return new WindowsDetails(deviceInfo, windowsInfo);
        } catch (Exception ignored) {
            return fallback;
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
        ProcessHandle.allProcesses().forEach(process -> {
            String command = process.info().command().orElse("");
            if (command.isBlank()) {
                return;
            }
            String filename = Path.of(command).getFileName().toString().toLowerCase(Locale.ROOT);
            int extension = filename.lastIndexOf('.');
            String key = extension > 0 ? filename.substring(0, extension) : filename;
            AppDefinition definition = KNOWN_APPS.get(key);
            if (definition != null) {
                found.putIfAbsent(key, new RunningApp(
                        key, definition.name(), definition.detail(), definition.icon(), true));
            }
        });
        return found.values().stream()
                .sorted(Comparator.comparing(RunningApp::name))
                .limit(6)
                .toList();
    }

    public PhoneLinkInfo phoneLink() {
        boolean windows = isWindows();
        Path packagePath = Path.of(environment("LOCALAPPDATA", "."), "Packages", "Microsoft.YourPhone_8wekyb3d8bbwe");
        boolean installed = windows && Files.isDirectory(packagePath);
        boolean running = ProcessHandle.allProcesses().anyMatch(process ->
                process.info().command().orElse("").toLowerCase(Locale.ROOT).matches(".*(phoneexperiencehost|crossdevice).*"));

        Path metadataPath = packagePath.resolve("LocalCache").resolve("DeviceMetadataStorage.json");
        Path companionPath = packagePath.resolve("LocalState").resolve("StartMenu").resolve("StartMenuCompanion.json");
        Optional<PhoneDevice> device = installed ? readPhoneDevice(metadataPath) : Optional.empty();
        Instant companionUpdatedAt = modifiedAt(companionPath).orElse(null);
        Instant metadataUpdatedAt = modifiedAt(metadataPath).orElse(null);
        Instant lastSeenAt = device.map(PhoneDevice::lastSeenAt).orElse(null);
        Instant lastSyncedAt = latest(companionUpdatedAt, metadataUpdatedAt, lastSeenAt);
        boolean connected = running
                && companionUpdatedAt != null
                && companionUpdatedAt.isAfter(Instant.now().minusSeconds(10 * 60));
        Integer batteryPercent = installed ? readBatteryPercent(companionPath).orElse(null) : null;
        boolean notificationsAvailable = installed && containsNotificationSignal(companionPath);
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

    private Optional<PhoneDevice> readPhoneDevice(Path metadataPath) {
        if (!Files.isRegularFile(metadataPath)) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(metadataPath.toFile());
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

    private Optional<Integer> readBatteryPercent(Path companionPath) {
        if (!Files.isRegularFile(companionPath)) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(companionPath.toFile());
            ArrayDeque<JsonNode> queue = new ArrayDeque<>();
            queue.add(root);
            while (!queue.isEmpty()) {
                JsonNode current = queue.removeFirst();
                if (current.isTextual()) {
                    String value = current.asText().trim();
                    if (value.matches("\\d{1,3}%")) {
                        int percent = Integer.parseInt(value.substring(0, value.length() - 1));
                        return Optional.of(Math.max(0, Math.min(100, percent)));
                    }
                } else if (current.isContainerNode()) {
                    current.elements().forEachRemaining(queue::addLast);
                }
            }
        } catch (Exception ignored) {
            // Phone Link may replace the companion file while it is being read.
        }
        return Optional.empty();
    }

    private boolean containsNotificationSignal(Path companionPath) {
        if (!Files.isRegularFile(companionPath)) {
            return false;
        }
        try {
            String content = Files.readString(companionPath).toLowerCase(Locale.ROOT);
            return content.contains("new messages are available") || content.contains("notification");
        } catch (Exception ignored) {
            return false;
        }
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
                        return new NetworkInfo(label, address, true);
                    })
                    .orElseGet(() -> new NetworkInfo("No active network", "Offline", false));
        } catch (Exception ignored) {
            // Return the explicit offline state below.
        }
        return new NetworkInfo("No active network", "Offline", false);
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
        if (!isWindows()) {
            return new BatteryInfo(false, null, "Unavailable");
        }
        try {
            Process process = new ProcessBuilder(
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "$b=Get-CimInstance Win32_Battery | Select-Object -First 1; if($b){Write-Output ($b.EstimatedChargeRemaining.ToString()+'|'+$b.BatteryStatus.ToString())}")
                    .redirectErrorStream(true)
                    .start();
            if (!process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return new BatteryInfo(false, null, "Unavailable");
            }
            String output = new String(process.getInputStream().readAllBytes()).trim();
            String[] parts = output.split("\\|");
            if (parts.length == 2) {
                int percent = Integer.parseInt(parts[0].trim());
                int status = Integer.parseInt(parts[1].trim());
                String detail = switch (status) {
                    case 2 -> "Discharging";
                    case 6, 7, 8, 9 -> "Charging";
                    default -> "Connected";
                };
                return new BatteryInfo(true, percent, detail);
            }
        } catch (Exception ignored) {
            // Desktops and restricted Windows accounts may not expose a battery.
        }
        return new BatteryInfo(false, null, "Desktop power");
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
            BatteryInfo battery) {}

    public record NetworkInfo(String name, String address, boolean connected) {}

    public record BatteryInfo(boolean available, Integer percent, String detail) {}

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
}
