package com.localassistant.os.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.localassistant.os.config.AssistantProperties;

/** Private, process-owned bridge. A failed mutation is never automatically replayed. */
@Service
public class WindowsBridgeClient implements AutoCloseable {
    private static final int MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Path executable;
    private final ExecutorService io = Executors.newSingleThreadExecutor(
            Thread.ofPlatform().daemon().name("windows-native-radio-io").factory());
    private Process process;
    private final Object connectionLock = new Object();
    private volatile FileChannel pipe;

    @Autowired
    public WindowsBridgeClient(AssistantProperties properties) {
        this(Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize()
                .resolve("native/build/Release/live-desktop-windows-bridge.exe"));
    }

    WindowsBridgeClient(Path executable) { this.executable = executable; }

    public synchronized Map<String, Object> request(String operation, Map<String, Object> arguments) {
        if (!System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT).contains("windows")) {
            return Map.of("available", false, "detail", "Windows integration is available on Windows only.");
        }
        try {
            var task = io.submit(() -> {
                connect();
                FileChannel channel = pipe;
                String id = UUID.randomUUID().toString();
                byte[] payload = mapper.writeValueAsBytes(Map.of("protocolVersion", 1,
                        "requestId", id, "operation", operation, "arguments", arguments));
                ByteBuffer output = ByteBuffer.wrap((new String(payload, StandardCharsets.UTF_8) + "\n")
                        .getBytes(StandardCharsets.UTF_8));
                while (output.hasRemaining()) channel.write(output);
                var response = new java.io.ByteArrayOutputStream();
                ByteBuffer byteBuffer = ByteBuffer.allocate(8192);
                while (response.size() < MAX_RESPONSE_BYTES) {
                    byteBuffer.clear();
                    if (channel.read(byteBuffer) < 0) throw new IOException("Native radio bridge disconnected.");
                    if (byteBuffer.position() == 0) continue;
                    byteBuffer.flip();
                    while (byteBuffer.hasRemaining()) {
                        byte value = byteBuffer.get();
                        if (value == '\n') return decode(mapper, response.toByteArray(), id);
                        if (response.size() >= MAX_RESPONSE_BYTES) throw new IOException("Native response exceeded the size limit.");
                        response.write(value);
                    }
                }
                throw new IOException("Native radio bridge response exceeded the size limit.");
            });
            try {
                return task.get(15, TimeUnit.SECONDS);
            } catch (Exception error) {
                reset();
                task.cancel(true);
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                return Map.of("available", false, "detail",
                        "Windows bridge failed or timed out. The request was not retried; refresh state before trying again.");
            }
        } catch (Exception error) {
            reset();
            return Map.of("available", false, "detail", "Windows bridge is unavailable.");
        }
    }

    static Map<String, Object> decode(ObjectMapper mapper, byte[] bytes, String expectedId) throws IOException {
        var root = mapper.readTree(bytes);
        if (root == null || !root.isObject() || root.path("protocolVersion").asInt(-1) != 1 || !root.path("requestId").asText().equals(expectedId)
                || !root.path("ok").isBoolean()) throw new IOException("Invalid native radio bridge envelope.");
        if (!root.path("ok").asBoolean()) {
            String code = root.path("error").path("code").asText("WINDOWS_ERROR");
            String message = root.path("error").path("message").asText("Windows radio operation failed.");
            return Map.of("available", false, "code", code, "detail", message);
        }
        if (!root.path("result").isObject()) throw new IOException("Invalid native radio bridge result.");
        return mapper.convertValue(root.get("result"), new TypeReference<Map<String, Object>>() {});
    }

    private void connect() throws Exception {
        synchronized (connectionLock) {
        if (process != null && process.isAlive() && pipe != null && pipe.isOpen()) return;
        reset();
        if (!Files.isRegularFile(executable)) throw new IOException("Build the native radio bridge before selecting native mode.");
        String name = "\\\\.\\pipe\\LiveDesktop.WindowsBridge." + UUID.randomUUID();
        process = new ProcessBuilder(executable.toString(), "--pipe", name, "--parent-pid",
                Long.toString(ProcessHandle.current().pid()))
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .redirectError(ProcessBuilder.Redirect.DISCARD).start();
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        while (process.isAlive() && System.nanoTime() < deadline) {
            try {
                pipe = new RandomAccessFile(name, "rw").getChannel();
                return;
            } catch (IOException notReady) {
                Thread.sleep(20);
            }
        }
        throw new IOException("Native radio bridge did not become ready.");
        }
    }

    private void reset() {
        synchronized (connectionLock) {
        // Terminate the peer first to release any blocking pipe IO, then close the channel.
        if (process != null) process.destroyForcibly();
        process = null;
        var current = pipe;
        pipe = null;
        if (current != null) try { current.close(); } catch (IOException ignored) { }
        }
    }

    @PreDestroy
    @Override public synchronized void close() {
        reset();
        io.shutdownNow();
    }
}
