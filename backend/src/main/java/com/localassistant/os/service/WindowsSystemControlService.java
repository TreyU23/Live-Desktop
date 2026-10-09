package com.localassistant.os.service;

import com.localassistant.os.config.AssistantProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class WindowsSystemControlService {
    private static final Duration SNAPSHOT_TTL = Duration.ofSeconds(30);
    private static final Set<String> DIRECT_CONTROLS = Set.of("wifi", "bluetooth");
    private final WindowsBridgeClient bridge;
    private final boolean ownsBridge;
    private CachedSnapshot cachedSnapshot;

    @Autowired
    public WindowsSystemControlService(WindowsBridgeClient bridge) {
        this.bridge = bridge;
        ownsBridge = false;
    }

    WindowsSystemControlService(AssistantProperties properties) {
        bridge = new WindowsBridgeClient(properties);
        ownsBridge = true;
    }

    WindowsBridgeClient bridge() { return bridge; }
    public boolean supports(String control) { return DIRECT_CONTROLS.contains(control); }

    public synchronized Map<String, Object> snapshot() {
        Instant now = Instant.now();
        if (cachedSnapshot != null && now.isBefore(cachedSnapshot.expiresAt())) return cachedSnapshot.value();
        Map<String, Object> value = Map.copyOf(bridge.request("radio.snapshot", Map.of()));
        cachedSnapshot = Boolean.TRUE.equals(value.get("available"))
                ? new CachedSnapshot(value, Instant.now().plus(SNAPSHOT_TTL)) : null;
        return value;
    }

    public synchronized Map<String, Object> set(String control, boolean enabled) {
        if (!supports(control)) throw new IllegalArgumentException("This Windows control cannot be changed directly.");
        Map<String, Object> result = bridge.request("radio.set", Map.of("control", control, "enabled", enabled));
        if (!Boolean.TRUE.equals(result.get("available"))) {
            cachedSnapshot = null;
            throw new IllegalStateException(String.valueOf(result.getOrDefault("detail", "Windows did not apply the change.")));
        }
        if (cachedSnapshot != null) {
            Map<String, Object> updated = new LinkedHashMap<>(cachedSnapshot.value());
            updated.put(control, Map.of("available", true, "enabled", result.get("enabled"), "state", result.get("state")));
            cachedSnapshot = new CachedSnapshot(Map.copyOf(updated), Instant.now().plus(SNAPSHOT_TTL));
        }
        return result;
    }

    public Map<String, Object> open(String operation, String uri) {
        Map<String, Object> result = bridge.request(operation, Map.of("uri", uri));
        if (!result.containsKey("opened")) throw new IllegalStateException(String.valueOf(result.getOrDefault("detail", "Windows could not open the target.")));
        return result;
    }

    void closeWorker() { if (ownsBridge) bridge.close(); }
    private record CachedSnapshot(Map<String, Object> value, Instant expiresAt) {}
}
