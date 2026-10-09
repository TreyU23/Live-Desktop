package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;

class WindowsSystemControlServiceTest {
    @Test
    void settingsShortcutsDelegateToCppBridgeWithoutClaimingToggleSupport() {
        WindowsBridgeClient bridge = mock(WindowsBridgeClient.class);
        WindowsSystemControlService controls = new WindowsSystemControlService(bridge);
        for (String uri : new String[]{
                "ms-settings:nightlight", "ms-settings:batterysaver",
                "ms-settings:quiethours", "ms-settings:privacy-microphone"}) {
            when(bridge.request("windows.openUri", Map.of("uri", uri))).thenReturn(Map.of("opened", uri));
            assertThat(controls.open("windows.openUri", uri)).containsEntry("opened", uri);
            verify(bridge).request("windows.openUri", Map.of("uri", uri));
        }
        for (String control : new String[]{"night-light", "battery-saver", "focus", "microphone"}) {
            assertThat(controls.supports(control)).isFalse();
            assertThatThrownBy(() -> controls.set(control, true)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void failedNativeShortcutIsReportedInsteadOfFallingBack() {
        WindowsBridgeClient bridge = mock(WindowsBridgeClient.class);
        WindowsSystemControlService controls = new WindowsSystemControlService(bridge);
        Map<String, Object> arguments = Map.of("uri", "ms-settings:nightlight");
        when(bridge.request("windows.openUri", arguments)).thenReturn(Map.of("available", false, "detail", "Native launch failed."));
        assertThatThrownBy(() -> controls.open("windows.openUri", "ms-settings:nightlight"))
                .isInstanceOf(IllegalStateException.class).hasMessage("Native launch failed.");
        verify(bridge).request("windows.openUri", arguments);
    }
}
