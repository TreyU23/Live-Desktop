package com.localassistant.os.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.localassistant.os.agent.AssistantAgent;
import com.localassistant.os.service.ActionService;
import com.localassistant.os.service.ICloudCalendarService;
import com.localassistant.os.service.MemoryService;
import com.localassistant.os.service.ProfileCredentialStore;
import com.localassistant.os.service.ProfileDataService;
import com.localassistant.os.service.RuntimeService;
import com.localassistant.os.service.SystemService;
import com.localassistant.os.service.WindowsMediaSessionService;
import com.localassistant.os.store.StateStore;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Issue #50: every settings response tells the UI about state files that were set aside. */
class StateRecoverySettingsTest {
    private StateStore store;
    private AssistantAgent agent;
    private AssistantController controller;

    @BeforeEach
    void setUp() {
        store = mock(StateStore.class);
        agent = mock(AssistantAgent.class);
        when(agent.settings()).thenAnswer(call -> new LinkedHashMap<>(Map.of("provider", "openai")));
        controller = new AssistantController(store, agent, mock(ActionService.class), mock(MemoryService.class),
                mock(SystemService.class), mock(RuntimeService.class), mock(ICloudCalendarService.class),
                mock(WindowsMediaSessionService.class), mock(ProfileCredentialStore.class),
                mock(ProfileDataService.class));
    }

    @Test
    void settingsCarryTheNamesOfSetAsideFiles() {
        String name = "assistant-state.json.corrupt-20261127T204512345Z";
        when(store.recoveredFiles()).thenReturn(List.of(name));

        assertThat(controller.profileSettings())
                .containsEntry("provider", "openai")
                .containsEntry("stateRecovery", Map.of("files", List.of(name)));
    }

    @Test
    void settingsReportAnEmptyListWhenNothingWasSetAside() {
        when(store.recoveredFiles()).thenReturn(List.of());

        assertThat(controller.profileSettings()).containsEntry("stateRecovery", Map.of("files", List.of()));
    }
}
