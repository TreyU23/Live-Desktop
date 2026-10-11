package com.localassistant.os.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.model.AssistantAction;
import com.localassistant.os.store.StateStore;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class DashboardContextService {
    private static final Set<String> ALLOWED_TOPICS = Set.of(
            "system", "apps", "phone", "calendar", "music", "runtime", "approvals", "summary");
    private static final long GIB = 1024L * 1024L * 1024L;

    private final SystemService system;
    private final RuntimeService runtime;
    private final ICloudCalendarService calendar;
    private final WindowsMediaSessionService media;
    private final ActionService actions;
    private final StateStore store;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DashboardContextService(
            SystemService system,
            RuntimeService runtime,
            ICloudCalendarService calendar,
            WindowsMediaSessionService media,
            ActionService actions,
            StateStore store) {
        this.system = system;
        this.runtime = runtime;
        this.calendar = calendar;
        this.media = media;
        this.actions = actions;
        this.store = store;
    }

    public String contextForPrompt(String prompt) {
        List<String> topics = topicsForPrompt(prompt);
        if (topics.isEmpty()) return "";
        try {
            return objectMapper.writeValueAsString(context(topics, dateForPrompt(prompt)));
        } catch (Exception error) {
            return "";
        }
    }

    public Map<String, Object> context(List<String> requestedTopics, String requestedDate) {
        LocalDate date;
        try {
            date = requestedDate == null || requestedDate.isBlank() ? LocalDate.now() : LocalDate.parse(requestedDate);
        } catch (Exception error) {
            throw new IllegalArgumentException("Calendar date must use YYYY-MM-DD.");
        }
        return context(normalizeTopics(requestedTopics), date);
    }

    List<String> topicsForPrompt(String prompt) {
        String normalized = prompt == null ? "" : prompt.toLowerCase(Locale.ROOT);
        LinkedHashSet<String> topics = new LinkedHashSet<>();
        if (containsAny(normalized, "dashboard", "overview", "everything", "what's happening", "whats happening")) {
            topics.addAll(List.of("summary", "system", "apps", "phone", "calendar", "music", "runtime", "approvals"));
            return List.copyOf(topics);
        }
        if (containsAny(normalized, "system", "computer", " pc ", "device", "cpu", "memory", "ram", "storage", "disk", "network", "wi-fi", "wifi", "bluetooth", "focus", "night light", "microphone", "battery saver", "windows version")) topics.add("system");
        if (containsAny(normalized, "running app", "recent app", "application", "process", "what apps", "which apps")) topics.add("apps");
        if (containsAny(normalized, "phone", "phone link", "notification", "last sync", "linked device")) topics.add("phone");
        if (containsAny(normalized, "calendar", "schedule", "event", "meeting", "appointment", "agenda", "what's on today", "whats on today")) topics.add("calendar");
        if (containsAny(normalized, "music", "song", "track", "artist", "album", "playlist", "playing", "pause", "skip")) topics.add("music");
        if (containsAny(normalized, "backend", "frontend", "localhost", "local host", "server", "restart", "shutdown", "offline", "online")) topics.add("runtime");
        if (containsAny(normalized, "approval", "pending action", "action queue", "queued action")) topics.add("approvals");
        if (containsAny(normalized, "memory", "memories", "remember", "conversation count")) topics.add("summary");
        if (normalized.contains("battery") && !topics.contains("phone")) topics.add("system");
        return List.copyOf(topics);
    }

    private Map<String, Object> context(List<String> topics, LocalDate date) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (String topic : topics) {
            switch (topic) {
                case "summary" -> result.put("summary", summary());
                case "system" -> result.put("system", systemContext());
                case "apps" -> result.put("runningApps", system.runningApps());
                case "phone" -> result.put("phoneLink", phoneContext());
                case "calendar" -> result.put("calendar", calendarContext(date));
                case "music" -> result.put("music", musicContext());
                case "runtime" -> result.put("runtime", runtime.status());
                case "approvals" -> result.put("approvals", approvalContext());
                default -> { }
            }
        }
        return result;
    }

    private Map<String, Object> summary() {
        return Map.of(
                "conversationCount", store.conversationSummaries().size(),
                "memoryCount", store.memories().size(),
                "pendingApprovalCount", actions.list("pending").size());
    }

    private Map<String, Object> systemContext() {
        var snapshot = system.snapshot();
        var resources = snapshot.resources();
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        result.put("capturedAt", snapshot.capturedAt());
        result.put("device", Map.of(
                "name", snapshot.host().name(),
                "os", snapshot.host().os(),
                "osVersion", snapshot.host().osVersion(),
                "architecture", snapshot.host().architecture()));
        result.put("resources", Map.of(
                "cpuPercent", resources.cpuPercent(),
                "memoryUsedGiB", gib(resources.memoryUsedBytes()),
                "memoryTotalGiB", gib(resources.memoryTotalBytes()),
                "storageUsedGiB", gib(resources.storageUsedBytes()),
                "storageTotalGiB", gib(resources.storageTotalBytes()),
                "network", resources.network(),
                "battery", resources.battery()));
        result.put("controls", snapshot.controls().stream().map(control -> Map.of(
                "id", control.id(),
                "enabled", control.enabled(),
                "available", control.available())).toList());
        return result;
    }

    private Map<String, Object> phoneContext() {
        var phone = system.phoneLink();
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        result.put("installed", phone.installed());
        result.put("running", phone.running());
        result.put("connected", phone.connected());
        result.put("deviceName", phone.deviceName());
        result.put("manufacturer", phone.manufacturer());
        result.put("model", phone.model());
        result.put("osName", phone.osName());
        result.put("batteryPercent", phone.batteryPercent());
        result.put("notificationsAvailable", phone.notificationsAvailable());
        result.put("lastSeenAt", phone.lastSeenAt());
        result.put("lastSyncedAt", phone.lastSyncedAt());
        result.put("detail", phone.detail());
        return result;
    }

    private Map<String, Object> calendarContext(LocalDate date) {
        var snapshot = calendar.snapshot(date, false);
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        result.put("connected", snapshot.connected());
        result.put("status", snapshot.status());
        result.put("detail", snapshot.detail());
        result.put("date", snapshot.date());
        result.put("events", snapshot.events().stream().limit(8).map(event -> Map.of(
                "title", event.title(),
                "start", event.start(),
                "end", event.end(),
                "allDay", event.allDay(),
                "location", event.location(),
                "calendar", event.calendar())).toList());
        return result;
    }

    private Map<String, Object> musicContext() {
        Map<String, Object> snapshot = media.snapshot();
        LinkedHashMap<String, Object> result = new LinkedHashMap<>();
        for (String key : List.of("available", "source", "playing", "status", "title", "artist", "album", "elapsed", "duration", "shuffled", "detail")) {
            if (snapshot.containsKey(key)) result.put(key, snapshot.get(key));
        }
        return result;
    }

    private List<Map<String, Object>> approvalContext() {
        return actions.list("pending").stream().limit(5).map(this::approvalSummary).toList();
    }

    private Map<String, Object> approvalSummary(AssistantAction action) {
        return Map.of(
                "id", action.id(),
                "kind", action.kind(),
                "reason", action.reason(),
                "createdAt", action.createdAt());
    }

    private List<String> normalizeTopics(List<String> requested) {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        if (requested != null) {
            for (String topic : requested) {
                String value = topic == null ? "" : topic.trim().toLowerCase(Locale.ROOT);
                if (ALLOWED_TOPICS.contains(value)) normalized.add(value);
                if (normalized.size() == 4) break;
            }
        }
        if (normalized.isEmpty()) throw new IllegalArgumentException("Request 1 to 4 dashboard topics.");
        return List.copyOf(normalized);
    }

    private LocalDate dateForPrompt(String prompt) {
        String normalized = prompt == null ? "" : prompt.toLowerCase(Locale.ROOT);
        if (normalized.contains("tomorrow")) return LocalDate.now().plusDays(1);
        if (normalized.contains("yesterday")) return LocalDate.now().minusDays(1);
        return LocalDate.now();
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private double gib(long bytes) {
        return Math.round((bytes / (double) GIB) * 10.0) / 10.0;
    }
}
