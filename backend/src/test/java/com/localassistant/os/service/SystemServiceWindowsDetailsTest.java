package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

// SystemService only calls the bridge on Windows.
@EnabledOnOs(value = OS.WINDOWS, disabledReason = "SystemService reads Windows details only on Windows")
class SystemServiceWindowsDetailsTest {
    private static final Map<String, Object> DETAILS = Map.of(
            "device", Map.of("manufacturer", "Contoso", "model", "Surface Test"),
            "windows", Map.of("edition", "Windows 11 Pro"));

    @TempDir
    Path root;

    private WindowsBridgeClient bridge;
    private SystemService system;
    private MutableClock clock;

    @BeforeEach
    void setUp() {
        AssistantProperties properties = new AssistantProperties();
        properties.setWorkspaceRoot(root.toString());
        WindowsSystemControlService controls = mock(WindowsSystemControlService.class);
        bridge = mock(WindowsBridgeClient.class);
        when(controls.bridge()).thenReturn(bridge);
        when(controls.snapshot()).thenReturn(Map.of());
        when(bridge.request(eq("power.snapshot"), anyMap())).thenReturn(Map.of());
        system = new SystemService(properties, controls);
        clock = new MutableClock(Instant.parse("2026-11-25T12:00:00Z"));
        system.clock = clock;
    }

    @Test
    void bridgeFailureIsRetriedAfterAShortDelayInsteadOfPinnedForever() {
        when(bridge.request(eq("system.staticSnapshot"), anyMap()))
                .thenThrow(new IllegalStateException("bridge still starting"))
                .thenReturn(DETAILS);

        assertThat(system.snapshot().device().manufacturer()).isEqualTo("Unavailable");
        // Inside the retry window the fallback is served from cache without another bridge call.
        clock.advance(SystemService.WINDOWS_DETAILS_RETRY_AFTER.minusSeconds(1));
        assertThat(system.snapshot().device().manufacturer()).isEqualTo("Unavailable");
        verify(bridge, times(1)).request(eq("system.staticSnapshot"), anyMap());

        clock.advance(Duration.ofSeconds(2));
        assertThat(system.snapshot().device().manufacturer()).isEqualTo("Contoso");
        assertThat(system.snapshot().windows().edition()).isEqualTo("Windows 11 Pro");
        verify(bridge, times(2)).request(eq("system.staticSnapshot"), anyMap());
    }

    @Test
    void successfulReadIsCachedForTheLifeOfTheProcess() {
        when(bridge.request(eq("system.staticSnapshot"), anyMap())).thenReturn(DETAILS);

        assertThat(system.snapshot().device().model()).isEqualTo("Surface Test");
        clock.advance(Duration.ofDays(3));
        assertThat(system.snapshot().device().model()).isEqualTo("Surface Test");
        verify(bridge, times(1)).request(eq("system.staticSnapshot"), anyMap());
    }

    @Test
    void missingDeviceSectionCountsAsAFailedRead() {
        when(bridge.request(eq("system.staticSnapshot"), anyMap()))
                .thenReturn(Map.of("windows", Map.of()))
                .thenReturn(DETAILS);

        assertThat(system.snapshot().device().graphics()).isEqualTo(List.of());
        clock.advance(SystemService.WINDOWS_DETAILS_RETRY_AFTER.plusSeconds(1));
        assertThat(system.snapshot().device().manufacturer()).isEqualTo("Contoso");
    }

    @Test
    void failedBatteryReadIsRetriedAfterAShortDelay() {
        when(bridge.request(eq("power.snapshot"), anyMap()))
                .thenReturn(Map.of("available", false, "detail", "Windows bridge is unavailable."))
                .thenReturn(batteryReading(80));

        assertThat(system.snapshot().resources().battery().available()).isFalse();
        clock.advance(SystemService.BATTERY_RETRY_AFTER.minusSeconds(1));
        assertThat(system.snapshot().resources().battery().available()).isFalse();
        verify(bridge, times(1)).request(eq("power.snapshot"), anyMap());

        clock.advance(Duration.ofSeconds(2));
        assertThat(system.snapshot().resources().battery().percent()).isEqualTo(80);
        verify(bridge, times(2)).request(eq("power.snapshot"), anyMap());
    }

    @Test
    void realBatteryReadingIsCachedForFiveMinutes() {
        when(bridge.request(eq("power.snapshot"), anyMap())).thenReturn(batteryReading(80));

        assertThat(system.snapshot().resources().battery().percent()).isEqualTo(80);
        clock.advance(Duration.ofMinutes(4));
        system.snapshot();
        verify(bridge, times(1)).request(eq("power.snapshot"), anyMap());

        clock.advance(Duration.ofMinutes(2));
        system.snapshot();
        verify(bridge, times(2)).request(eq("power.snapshot"), anyMap());
    }

    @Test
    void desktopWithoutABatteryIsAnAnswerNotAFailure() {
        Map<String, Object> desktop = new java.util.HashMap<>();
        desktop.put("available", false);
        desktop.put("percent", null);
        desktop.put("detail", "Desktop power");
        when(bridge.request(eq("power.snapshot"), anyMap())).thenReturn(desktop);

        assertThat(system.snapshot().resources().battery().detail()).isEqualTo("Desktop power");
        clock.advance(Duration.ofMinutes(1));
        system.snapshot();
        verify(bridge, times(1)).request(eq("power.snapshot"), anyMap());
    }

    private static Map<String, Object> batteryReading(int percent) {
        return Map.of("available", true, "percent", percent, "detail", "Discharging");
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant start) {
            now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
