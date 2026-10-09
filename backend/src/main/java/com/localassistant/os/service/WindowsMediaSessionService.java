package com.localassistant.os.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class WindowsMediaSessionService {
    private static final Set<String> ACTIONS = Set.of("snapshot", "play", "pause", "next", "previous", "shuffle", "mute");
    private final WindowsBridgeClient bridge;

    public WindowsMediaSessionService(WindowsBridgeClient bridge) {
        this.bridge = bridge;
    }

    public Map<String, Object> snapshot() {
        return snapshot("music");
    }

    public Map<String, Object> snapshot(String provider) {
        return invoke("snapshot", normalizeProvider(provider));
    }

    public Map<String, Object> control(String action) {
        return control(action, "music");
    }

    public Map<String, Object> control(String action, String provider) {
        String normalized = action == null ? "" : action.trim().toLowerCase();
        if (!ACTIONS.contains(normalized) || normalized.equals("snapshot")) {
            throw new IllegalArgumentException("Media action must be play, pause, next, previous, shuffle, or mute.");
        }
        return invoke(normalized, normalizeProvider(provider));
    }

    private String normalizeProvider(String provider) {
        String normalized = provider == null ? "music" : provider.trim().toLowerCase();
        if (!Set.of("apple", "spotify", "music").contains(normalized)) {
            throw new IllegalArgumentException("Music provider must be apple or spotify.");
        }
        return normalized;
    }

    private Map<String, Object> invoke(String action, String provider) {
        Map<String, Object> result = bridge.request("media." + action, Map.of("provider", provider));
        return result.containsKey("title") ? result : unavailable(provider, String.valueOf(result.getOrDefault("detail", "Windows media controls are unavailable.")));
    }

    private Map<String, Object> unavailable(String provider, String detail) {
        String providerName = provider.equals("apple") ? "Apple Music" : provider.equals("spotify") ? "Spotify" : "Music";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", false);
        result.put("ready", false);
        result.put("playing", false);
        result.put("title", "Nothing playing");
        result.put("artist", providerName);
        result.put("album", "Start a track in " + providerName + " or the web player");
        result.put("artwork", "/assets/album-cover.png");
        result.put("elapsed", 0);
        result.put("duration", 0);
        result.put("shuffled", false);
        result.put("detail", detail);
        return result;
    }
}
