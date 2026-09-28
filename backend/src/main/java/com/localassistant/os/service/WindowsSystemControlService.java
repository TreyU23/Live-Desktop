package com.localassistant.os.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Service;

@Service
public class WindowsSystemControlService {
    private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(12);
    private static final Duration SNAPSHOT_TTL = Duration.ofSeconds(30);
    private static final Set<String> DIRECT_CONTROLS = Set.of("wifi", "bluetooth");
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path workspaceRoot;
    private final Path script;
    private final Object workerLock = new Object();
    private final ExecutorService workerReader = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon(true).name("windows-radio-worker-reader").factory());
    private volatile CachedSnapshot cachedSnapshot;
    private Process workerProcess;
    private BufferedWriter workerInput;
    private BufferedReader workerOutput;

    public WindowsSystemControlService(AssistantProperties properties) {
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        script = workspaceRoot.resolve("scripts").resolve("windows-system-control.ps1").normalize();
    }

    public boolean supports(String control) {
        return DIRECT_CONTROLS.contains(control);
    }

    @PostConstruct
    void warmWorker() {
        if (!isWindows() || !script.startsWith(workspaceRoot) || !Files.isRegularFile(script)) {
            return;
        }
        synchronized (workerLock) {
            try {
                startWorker();
            } catch (IOException ignored) {
                // The normal request path retains the one-shot fallback.
            }
        }
    }

    public Map<String, Object> snapshot() {
        CachedSnapshot current = cachedSnapshot;
        Instant now = Instant.now();
        if (current != null && now.isBefore(current.expiresAt())) {
            return current.value();
        }
        synchronized (this) {
            current = cachedSnapshot;
            now = Instant.now();
            if (current != null && now.isBefore(current.expiresAt())) {
                return current.value();
            }
            Map<String, Object> value = Map.copyOf(invoke("snapshot", "wifi", true));
            cachedSnapshot = new CachedSnapshot(value, now.plus(SNAPSHOT_TTL));
            return value;
        }
    }

    public Map<String, Object> set(String control, boolean enabled) {
        if (!supports(control)) {
            throw new IllegalArgumentException("This Windows control cannot be changed directly.");
        }
        Map<String, Object> result = invoke("set", control, enabled);
        if (!Boolean.TRUE.equals(result.get("available"))) {
            throw new IllegalStateException(String.valueOf(result.getOrDefault("detail", "Windows did not apply the change.")));
        }
        updateCachedControl(control, result);
        return result;
    }

    private synchronized void updateCachedControl(String control, Map<String, Object> result) {
        CachedSnapshot current = cachedSnapshot;
        Instant now = Instant.now();
        if (current == null || !now.isBefore(current.expiresAt())) {
            cachedSnapshot = null;
            return;
        }
        Map<String, Object> updated = new LinkedHashMap<>(current.value());
        updated.put(control, Map.of(
                "available", true,
                "enabled", Boolean.TRUE.equals(result.get("enabled")),
                "state", String.valueOf(result.getOrDefault("state", "Unknown"))));
        cachedSnapshot = new CachedSnapshot(Map.copyOf(updated), now.plus(SNAPSHOT_TTL));
    }

    private Map<String, Object> invoke(String action, String control, boolean enabled) {
        if (!isWindows()) {
            return Map.of("available", false, "detail", "Windows system controls are available on Windows only.");
        }
        if (!script.startsWith(workspaceRoot) || !Files.isRegularFile(script)) {
            return Map.of("available", false, "detail", "The local Windows control script is unavailable.");
        }
        try {
            return invokeWorker(action, control, enabled);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            resetWorker();
            return Map.of("available", false, "detail", "Windows system control was interrupted.");
        } catch (Exception workerError) {
            resetWorker();
            return invokeOneShot(action, control, enabled);
        }
    }

    private Map<String, Object> invokeWorker(String action, String control, boolean enabled)
            throws IOException, InterruptedException, ExecutionException, TimeoutException {
        synchronized (workerLock) {
            startWorker();
            String request = objectMapper.writeValueAsString(Map.of(
                    "action", action,
                    "control", control,
                    "target", enabled ? "on" : "off"));
            workerInput.write(request);
            workerInput.newLine();
            workerInput.flush();

            Future<String> response = workerReader.submit(workerOutput::readLine);
            String output;
            try {
                output = response.get(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            } catch (TimeoutException error) {
                response.cancel(true);
                throw error;
            }
            if (output == null || output.isBlank()) {
                throw new IOException("Windows radio worker stopped without returning a result.");
            }
            return objectMapper.readValue(output, new TypeReference<>() {});
        }
    }

    private void startWorker() throws IOException {
        if (workerProcess != null && workerProcess.isAlive()) {
            return;
        }
        resetWorkerLocked();
        workerProcess = new ProcessBuilder(
                        "powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
                        "-ExecutionPolicy", "Bypass", "-File", script.toString(), "-Action", "worker")
                .redirectError(ProcessBuilder.Redirect.DISCARD)
                .start();
        workerInput = new BufferedWriter(new OutputStreamWriter(workerProcess.getOutputStream(), StandardCharsets.UTF_8));
        workerOutput = new BufferedReader(new InputStreamReader(workerProcess.getInputStream(), StandardCharsets.UTF_8));
    }

    private Map<String, Object> invokeOneShot(String action, String control, boolean enabled) {
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

    private void resetWorker() {
        synchronized (workerLock) {
            resetWorkerLocked();
        }
    }

    private void resetWorkerLocked() {
        if (workerProcess != null) {
            workerProcess.destroyForcibly();
        }
        workerProcess = null;
        workerInput = null;
        workerOutput = null;
    }

    @PreDestroy
    void closeWorker() {
        resetWorker();
        workerReader.shutdownNow();
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("windows");
    }

    private record CachedSnapshot(Map<String, Object> value, Instant expiresAt) {}
}
