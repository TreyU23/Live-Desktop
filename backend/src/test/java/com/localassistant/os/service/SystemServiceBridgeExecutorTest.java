package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

@EnabledOnOs(value = OS.WINDOWS, disabledReason = "SystemService calls the bridge only on Windows")
class SystemServiceBridgeExecutorTest {
    @TempDir
    Path root;

    private final Set<String> bridgeThreads = ConcurrentHashMap.newKeySet();
    private SystemService system;

    @BeforeEach
    void setUp() {
        AssistantProperties properties = new AssistantProperties();
        properties.setWorkspaceRoot(root.toString());
        WindowsSystemControlService controls = mock(WindowsSystemControlService.class);
        WindowsBridgeClient bridge = mock(WindowsBridgeClient.class);
        when(controls.bridge()).thenReturn(bridge);
        when(controls.snapshot()).thenAnswer(invocation -> record(Map.of()));
        when(bridge.request(eq("power.snapshot"), anyMap())).thenAnswer(invocation -> record(Map.of()));
        when(bridge.request(eq("system.ioCounters"), anyMap())).thenAnswer(invocation -> record(Map.of()));
        when(bridge.request(eq("system.staticSnapshot"), anyMap())).thenReturn(Map.of());
        system = new SystemService(properties, controls);
    }

    @AfterEach
    void tearDown() {
        system.shutdownBridgeExecutor();
    }

    @Test
    void snapshotFanOutRunsOnTheDedicatedBridgePoolNotTheCommonPool() {
        system.snapshot();

        assertThat(bridgeThreads).isNotEmpty();
        assertThat(bridgeThreads).allSatisfy(name -> assertThat(name).startsWith("system-bridge-"));
        assertThat(bridgeThreads).noneMatch(name -> name.contains("ForkJoinPool"));
    }

    @Test
    void snapshotStillCompletesAfterTheBridgePoolShutsDown() {
        system.shutdownBridgeExecutor();

        // Rejected tasks run on the caller's thread instead of being dropped, so join() returns.
        assertThat(system.snapshot()).isNotNull();
    }

    private Map<String, Object> record(Map<String, Object> result) {
        bridgeThreads.add(Thread.currentThread().getName());
        return result;
    }
}
