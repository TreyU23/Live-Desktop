package com.localassistant.os.service;

import com.localassistant.os.config.AssistantProperties;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class RuntimeService {
    private static final int FRONTEND_PORT = 4173;
    private static final int BACKEND_PORT = 4317;

    private final Path workspaceRoot;
    private final Path lifecycleLauncher;
    private final Path lifecycleLog;

    public RuntimeService(AssistantProperties properties) {
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        lifecycleLauncher = workspaceRoot.resolve("native/build/Release/live-desktop-launcher.exe").normalize();
        lifecycleLog = workspaceRoot.resolve("data").resolve("runtime-control.log").normalize();
    }

    public RuntimeStatus status() {
        return new RuntimeStatus(
                true,
                listening(FRONTEND_PORT),
                ProcessHandle.current().pid(),
                Instant.now().toString());
    }

    public LifecycleRequest request(String action) throws IOException {
        String normalized = action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("restart") && !normalized.equals("shutdown")) {
            throw new IllegalArgumentException("Lifecycle action must be restart or shutdown.");
        }
        if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("windows")) {
            throw new IllegalStateException("Project lifecycle controls are available on Windows only.");
        }
        if (!lifecycleLauncher.startsWith(workspaceRoot) || !Files.isRegularFile(lifecycleLauncher)) {
            throw new IllegalStateException("Native lifecycle launcher is unavailable. Build production artifacts first.");
        }

        Files.createDirectories(lifecycleLog.getParent());
        ProcessBuilder builder = new ProcessBuilder(
                lifecycleLauncher.toString(),
                normalized,
                "--root",
                workspaceRoot.toString(),
                "--request");
        builder.directory(workspaceRoot.toFile());
        builder.redirectOutput(ProcessBuilder.Redirect.appendTo(lifecycleLog.toFile()));
        builder.redirectError(ProcessBuilder.Redirect.appendTo(lifecycleLog.toFile()));
        Process process = builder.start();
        try {
            if (!process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("Native lifecycle request timed out.");
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Native lifecycle request failed. See data/runtime-control.log.");
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Native lifecycle request interrupted.", interrupted);
        }

        return new LifecycleRequest(normalized, "accepted", Instant.now().toString());
    }

    private boolean listening(int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 250);
            return true;
        } catch (IOException ignored) {
            return false;
        }
    }

    public record RuntimeStatus(boolean backendOnline, boolean frontendOnline, long backendPid, String capturedAt) {}

    public record LifecycleRequest(String action, String status, String acceptedAt) {}
}
