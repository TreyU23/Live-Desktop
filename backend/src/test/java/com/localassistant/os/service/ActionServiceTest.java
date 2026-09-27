package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.store.StateStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ActionServiceTest {
    @TempDir
    Path root;

    private ActionService actions;
    private MemoryService memories;
    private WindowsSystemControlService systemControls;

    @BeforeEach
    void setUp() throws Exception {
        AssistantProperties properties = new AssistantProperties();
        properties.setDataDir(root.resolve("data").toString());
        properties.setWorkspaceRoot(root.toString());
        StateStore store = new StateStore(new ProfilePaths(properties));
        WorkspaceService workspace = new WorkspaceService(properties);
        memories = new MemoryService(store);
        systemControls = mock(WindowsSystemControlService.class);
        when(systemControls.supports("wifi")).thenReturn(true);
        actions = new ActionService(store, workspace, memories, systemControls);
    }

    @Test
    void proposedWritesDoNothingUntilApproved() throws Exception {
        var action = actions.propose(
                "workspace_write_file",
                Map.of("path", "notes/approved.txt", "content", "approved content"),
                "Test approval.");

        assertThat(root.resolve("notes/approved.txt")).doesNotExist();
        assertThat(actions.approve(action.id()).status()).isEqualTo("completed");
        assertThat(Files.readString(root.resolve("notes/approved.txt"))).isEqualTo("approved content");
    }

    @Test
    void rejectedMemoryIsNotStored() throws Exception {
        var action = actions.propose(
                "remember",
                Map.of("content", "Temporary", "category", "preference"),
                "Test rejection.");
        actions.reject(action.id());
        assertThat(memories.list()).isEmpty();
    }

    @Test
    void nonWebUrlsAreRejectedBeforeQueueing() {
        assertThatThrownBy(() -> actions.propose(
                "browser_open_url",
                Map.of("url", "file:///C:/Windows/System32/calc.exe"),
                "Should not queue."))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only HTTP and HTTPS");
    }

    @Test
    void unknownWindowsUrisAreRejectedBeforeQueueing() {
        assertThatThrownBy(() -> actions.propose(
                "windows_open_uri",
                Map.of("uri", "file:///C:/Windows/System32/calc.exe"),
                "Should not queue."))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("approved capability list");
    }

    @Test
    void directWindowsControlsDoNothingUntilApproved() throws Exception {
        when(systemControls.set("wifi", false)).thenReturn(Map.of("available", true, "enabled", false));

        var action = actions.propose(
                "windows_set_control",
                Map.of("control", "wifi", "enabled", false),
                "Turn Wi-Fi off.");

        assertThat(action.status()).isEqualTo("pending");
        verify(systemControls, org.mockito.Mockito.never()).set("wifi", false);
        assertThat(actions.approve(action.id()).status()).isEqualTo("completed");
        verify(systemControls).set("wifi", false);
    }

    @Test
    void unknownDirectWindowsControlsAreRejectedBeforeQueueing() {
        assertThatThrownBy(() -> actions.propose(
                "windows_set_control",
                Map.of("control", "night-light", "enabled", true),
                "Should not queue."))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("approved direct-control list");
    }
}
