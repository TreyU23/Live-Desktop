package com.localassistant.os.service;

import com.localassistant.os.model.AssistantAction;
import com.localassistant.os.store.StateStore;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class ActionService {
    private static final Set<String> ALLOWED_WINDOWS_URIS = Set.of(
            "ms-settings:network-wifi",
            "ms-settings:bluetooth",
            "ms-settings:quiethours",
            "ms-settings:nightlight",
            "ms-settings:privacy-microphone",
            "ms-settings:batterysaver",
            "ms-phone:");
    private final StateStore store;
    private final WorkspaceService workspace;
    private final MemoryService memories;
    private final WindowsSystemControlService systemControls;

    public ActionService(
            StateStore store,
            WorkspaceService workspace,
            MemoryService memories,
            WindowsSystemControlService systemControls) {
        this.store = store;
        this.workspace = workspace;
        this.memories = memories;
        this.systemControls = systemControls;
    }

    public List<AssistantAction> list(String status) {
        return store.snapshot().actions().stream()
                .filter(action -> status == null || status.isBlank() || action.status().equals(status))
                .toList();
    }

    public AssistantAction propose(String kind, Map<String, Object> arguments, String reason) throws IOException {
        validate(kind, arguments);
        String approvalKey = approvalKey(kind, arguments);
        boolean previouslyApproved = hasPreviousApproval(approvalKey);
        AssistantAction action = store.addAction(
                kind, arguments, requireString(reason, "reason", 1, 2_000));
        return previouslyApproved ? approve(action.id()) : action;
    }

    public AssistantAction reject(String id) throws IOException {
        return store.updateAction(id, action -> {
            requirePending(action);
            return replaceStatus(action, "rejected", null, null);
        });
    }

    public AssistantAction approve(String id) throws IOException {
        AssistantAction approved = store.updateAction(id, action -> {
            requirePending(action);
            return replaceStatus(action, "approved", null, null);
        });

        try {
            Object result = execute(approved);
            return store.updateAction(id, action -> replaceStatus(action, "completed", result, null));
        } catch (Exception error) {
            return store.updateAction(id, action -> replaceStatus(action, "failed", null, error.getMessage()));
        }
    }

    private void validate(String kind, Map<String, Object> arguments) {
        switch (kind) {
            case "workspace_write_file" -> {
                requireString(arguments.get("path"), "path", 1, 500);
                requireString(arguments.get("content"), "content", 0, 500_000);
            }
            case "browser_open_url" -> parseWebUri(requireString(arguments.get("url"), "url", 1, 2_000));
            case "windows_open_uri" -> parseWindowsUri(requireString(arguments.get("uri"), "uri", 1, 200));
            case "windows_set_control" -> {
                String control = requireString(arguments.get("control"), "control", 1, 40);
                if (!systemControls.supports(control)) {
                    throw new IllegalArgumentException("Windows control is not in the approved direct-control list.");
                }
                if (!(arguments.get("enabled") instanceof Boolean)) {
                    throw new IllegalArgumentException("enabled must be a boolean.");
                }
            }
            case "remember" -> {
                requireString(arguments.get("content"), "content", 1, 2_000);
                requireString(arguments.get("category"), "category", 1, 32);
            }
            default -> throw new IllegalArgumentException("Unknown action kind.");
        }
    }

    private boolean hasPreviousApproval(String approvalKey) throws IOException {
        for (AssistantAction action : store.snapshot().actions()) {
            if (Set.of("approved", "completed", "failed").contains(action.status())
                    && approvalKey(action.kind(), action.arguments()).equals(approvalKey)) {
                return true;
            }
        }
        return false;
    }

    private String approvalKey(String kind, Map<String, Object> arguments) throws IOException {
        return switch (kind) {
            case "workspace_write_file" -> {
                Path path = workspace.resolveSafePath(String.valueOf(arguments.get("path")));
                yield kind + ":" + workspace.root().relativize(path).normalize().toString()
                        .toLowerCase(Locale.ROOT);
            }
            case "browser_open_url" -> kind + ":"
                    + parseWebUri(String.valueOf(arguments.get("url"))).normalize();
            case "windows_open_uri" -> kind + ":"
                    + parseWindowsUri(String.valueOf(arguments.get("uri"))).toLowerCase(Locale.ROOT);
            case "windows_set_control" -> kind + ":"
                    + String.valueOf(arguments.get("control")).toLowerCase(Locale.ROOT);
            case "remember" -> kind + ":"
                    + String.valueOf(arguments.get("category")).toLowerCase(Locale.ROOT);
            default -> throw new IllegalArgumentException("Unknown action kind.");
        };
    }

    private Object execute(AssistantAction action) throws IOException {
        if (action.kind().equals("workspace_write_file")) {
            String candidate = String.valueOf(action.arguments().get("path"));
            String content = String.valueOf(action.arguments().get("content"));
            Path path = workspace.resolveSafePath(candidate);
            Files.createDirectories(path.getParent());
            Files.writeString(path, content, StandardCharsets.UTF_8);
            return Map.of("path", workspace.root().relativize(path).toString(), "bytes", content.getBytes(StandardCharsets.UTF_8).length);
        }
        if (action.kind().equals("browser_open_url")) {
            URI uri = parseWebUri(String.valueOf(action.arguments().get("url")));
            if (!System.getProperty("os.name", "").toLowerCase().contains("windows")) {
                throw new IllegalStateException("The browser launcher is currently implemented for Windows only.");
            }
            new ProcessBuilder("rundll32.exe", "url.dll,FileProtocolHandler", uri.toString()).start();
            return Map.of("opened", uri.toString());
        }
        if (action.kind().equals("windows_open_uri")) {
            String uri = parseWindowsUri(String.valueOf(action.arguments().get("uri")));
            if (!System.getProperty("os.name", "").toLowerCase().contains("windows")) {
                throw new IllegalStateException("Windows settings are available on Windows only.");
            }
            new ProcessBuilder("explorer.exe", uri).start();
            return Map.of("opened", uri);
        }
        if (action.kind().equals("windows_set_control")) {
            return systemControls.set(
                    String.valueOf(action.arguments().get("control")),
                    Boolean.TRUE.equals(action.arguments().get("enabled")));
        }
        return memories.add(
                String.valueOf(action.arguments().get("content")),
                String.valueOf(action.arguments().get("category")));
    }

    private void requirePending(AssistantAction action) {
        if (!action.status().equals("pending")) {
            throw new IllegalArgumentException("Only pending actions can be changed.");
        }
    }

    private AssistantAction replaceStatus(
            AssistantAction action, String status, Object result, String error) {
        return new AssistantAction(
                action.id(), action.kind(), status, action.arguments(), action.reason(), result, error,
                action.createdAt(), action.updatedAt());
    }

    private URI parseWebUri(String value) {
        URI uri = URI.create(value);
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
            throw new IllegalArgumentException("Only HTTP and HTTPS URLs are allowed.");
        }
        return uri;
    }

    private String parseWindowsUri(String value) {
        if (!ALLOWED_WINDOWS_URIS.contains(value)) {
            throw new IllegalArgumentException("Windows URI is not in the approved capability list.");
        }
        return value;
    }

    private String requireString(Object value, String name, int minimum, int maximum) {
        if (!(value instanceof String string) || string.length() < minimum || string.length() > maximum) {
            throw new IllegalArgumentException(
                    name + " must be a string between " + minimum + " and " + maximum + " characters.");
        }
        return string;
    }
}
