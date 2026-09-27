package com.localassistant.os.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

@Service
public class WindowsSystemControlService {
    private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(12);
    private static final Set<String> DIRECT_CONTROLS = Set.of("wifi", "bluetooth");
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path workspaceRoot;
    private final Path script;

    public WindowsSystemControlService(AssistantProperties properties) {
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        script = workspaceRoot.resolve("scripts").resolve("windows-system-control.ps1").normalize();
    }

    public boolean supports(String control) {
        return DIRECT_CONTROLS.contains(control);
    }

    public Map<String, Object> snapshot() {
        return invoke("snapshot", "wifi", true);
    }

    public Map<String, Object> set(String control, boolean enabled) {
        if (!supports(control)) {
            throw new IllegalArgumentException("This Windows control cannot be changed directly.");
        }
        Map<String, Object> result = invoke("set", control, enabled);
        if (!Boolean.TRUE.equals(result.get("available"))) {
            throw new IllegalStateException(String.valueOf(result.getOrDefault("detail", "Windows did not apply the change.")));
        }
        return result;
    }

    private Map<String, Object> invoke(String action, String control, boolean enabled) {
        if (!isWindows()) {
            return Map.of("available", false, "detail", "Windows system controls are available on Windows only.");
        }
        if (!script.startsWith(workspaceRoot) || !Files.isRegularFile(script)) {
            return Map.of("available", false, "detail", "The local Windows control script is unavailable.");
        }
        try {
            Process process = new ProcessBuilder(
                            "powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
                            "-ExecutionPolicy", "Bypass", "-File", script.toString(),
                            "-Action", action, "-Control", control, "-Target", enabled ? "on" : "off")
                    .redirectErrorStream(false)
                    .start();
            if (!process.waitFor(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                return Map.of("available", false, "detail", "Windows system control timed out.");
            }
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            String error = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            if (output.isBlank()) {
                return Map.of("available", false, "detail", error.isBlank() ? "Windows did not return a control result." : error);
            }
            Map<String, Object> result = objectMapper.readValue(output, new TypeReference<>() {});
            if (process.exitValue() != 0 && !result.containsKey("detail")) {
                return Map.of("available", false, "detail", error.isBlank() ? "Windows rejected the control request." : error);
            }
            return result;
        } catch (Exception error) {
            return Map.of("available", false, "detail", error.getMessage() == null ? error.toString() : error.getMessage());
        }
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("windows");
    }
}
