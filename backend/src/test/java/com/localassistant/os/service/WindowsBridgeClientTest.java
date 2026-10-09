package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

class WindowsBridgeClientTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @TempDir Path root;

    private Map<String, Object> decode(String json) throws Exception {
        return WindowsBridgeClient.decode(mapper, json.getBytes(StandardCharsets.UTF_8), "test");
    }

    @Test void preservesRadioResultContract() throws Exception {
        assertThat(decode("""
            {"protocolVersion":1,"requestId":"test","ok":true,"result":{"available":true,"enabled":false,"state":"Off"}}
            """)).containsEntry("available", true).containsEntry("enabled", false).containsEntry("state", "Off");
    }

    @Test void propagatesWindowsDenial() throws Exception {
        assertThat(decode("""
            {"protocolVersion":1,"requestId":"test","ok":false,"error":{"code":"ACCESS_DENIED","message":"Denied"}}
            """)).containsEntry("available", false).containsEntry("code", "ACCESS_DENIED").containsEntry("detail", "Denied");
    }

    @Test void rejectsMismatchedIdVersionAndMalformedResult() {
        for (String json : new String[]{
            "{\"protocolVersion\":1,\"requestId\":\"wrong\",\"ok\":true,\"result\":{}}",
            "{\"protocolVersion\":2,\"requestId\":\"test\",\"ok\":true,\"result\":{}}",
            "{\"protocolVersion\":1,\"requestId\":\"test\",\"ok\":true,\"result\":[]}", "invalid"
        }) assertThatThrownBy(() -> decode(json)).isInstanceOf(java.io.IOException.class);
    }

    @Test void missingExecutableFailsWithoutFallbackOrRetry() {
        try (var bridge = new WindowsBridgeClient(root.resolve("missing.exe"))) {
            assertThat(bridge.request("radio.set", Map.of("control", "wifi", "enabled", false)))
                    .containsEntry("available", false);
            // A later request must remain responsive after resetting a failed connection.
            assertThat(bridge.request("radio.snapshot", Map.of())).containsEntry("available", false);
        }
    }

    @Test void nativeProviderReportsMissingBridgeAndRejectsUnknownControl() {
        var properties = new AssistantProperties();
        properties.setWorkspaceRoot(root.toString());
        var service = new WindowsSystemControlService(properties);
        try {
            assertThat(service.snapshot()).containsEntry("available", false);
            assertThat(service.snapshot()).containsEntry("available", false);
            assertThatThrownBy(() -> service.set("focus", true)).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.set("wifi", false)).isInstanceOf(IllegalStateException.class);
        } finally {
            service.closeWorker();
        }
    }

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void builtNativeBridgeSupportsLiveJavaReadsAndCleanRelaunch() throws Exception {
        Path executable = Path.of(System.getProperty("user.dir")).resolve("../native/build/Release/live-desktop-windows-bridge.exe").normalize();
        Assumptions.assumeTrue(Files.isRegularFile(executable), "Build the native bridge to run the live pipe test.");
        for (int launch = 0; launch < 2; launch++) {
            try (var bridge = new WindowsBridgeClient(executable)) {
                assertThat(bridge.request("bridge.health", Map.of())).containsEntry("status", "ok");
                var processField = WindowsBridgeClient.class.getDeclaredField("process");
                processField.setAccessible(true);
                Process ownedProcess = (Process) processField.get(bridge);
                ownedProcess.destroyForcibly().waitFor();
                // Only a new read is requested. No failed mutation is replayed.
                assertThat(bridge.request("bridge.health", Map.of())).containsEntry("status", "ok");
                for (int read = 0; read < 3; read++) {
                    assertThat(bridge.request("radio.snapshot", Map.of()))
                            .containsEntry("available", true).containsKeys("wifi", "bluetooth");
                }
                assertThat(bridge.request("system.staticSnapshot", Map.of())).containsKeys("device", "windows");
                assertThat(bridge.request("power.snapshot", Map.of())).containsKeys("available", "percent", "detail");
                assertThat(bridge.request("process.knownApps", Map.of())).containsKeys("processes", "phoneLinkInstalled", "phoneLinkRunning");
                assertThat(bridge.request("media.snapshot", Map.of("provider", "music"))).containsKeys("available", "title", "duration", "artwork");
                assertThat(bridge.request("media.snapshot", Map.of("provider", "unknown"))).containsEntry("available", false);
                assertThat(bridge.request("windows.openUri", Map.of("uri", "file:///C:/Windows"))).containsEntry("available", false);
                assertThat(bridge.request("browser.openUrl", Map.of("uri", "javascript:alert(1)"))).containsEntry("available", false);
                assertThat(bridge.request("unregistered.operation", Map.of())).containsEntry("available", false);
                assertThat(bridge.request("bridge.health", Map.of())).containsEntry("status", "ok");
            }
        }
    }
}
