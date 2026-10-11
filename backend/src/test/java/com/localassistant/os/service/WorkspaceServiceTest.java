package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.localassistant.os.config.AssistantProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

class WorkspaceServiceTest {
    @TempDir
    Path root;

    @Test
    void pathsCannotEscapeTheConfiguredRoot() {
        WorkspaceService workspace = workspace();
        assertThatThrownBy(() -> workspace.resolveSafePath("../outside.txt"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("outside the configured workspace");
    }

    @Test
    void fileListingAndReadingStayLocal() throws Exception {
        Files.createDirectories(root.resolve("notes"));
        Files.writeString(root.resolve("notes/hello.txt"), "hello");
        WorkspaceService workspace = workspace();

        assertThat(workspace.listFiles(".", 200)).containsExactly(Path.of("notes/hello.txt").toString());
        assertThat(workspace.readTextFile("notes/hello.txt"))
                .isEqualTo(new WorkspaceService.FileContents(Path.of("notes/hello.txt").toString(), "hello"));
    }

    @Test
    void workspaceReadToolsExcludeEnvironmentAndProfileDataButKeepTemplatesAndSource() throws Exception {
        Files.writeString(root.resolve(".env"), "secret");
        Files.writeString(root.resolve(".env.local"), "secret");
        Files.writeString(root.resolve(".env.example"), "template");
        Files.createDirectory(root.resolve("data"));
        Files.writeString(root.resolve("data/secret.json"), "private profile");
        Path configuredData = Files.createDirectory(root.resolve("custom-profile-data"));
        Files.writeString(configuredData.resolve("assistant-state.json"), "private conversation");
        Files.writeString(root.resolve("source.java"), "source");
        AssistantProperties properties = new AssistantProperties();
        properties.setWorkspaceRoot(root.toString());
        properties.setDataDir(configuredData.toString());
        WorkspaceService workspace = new WorkspaceService(properties);
        for (String path : new String[] { ".env", ".env.local", "data/secret.json", "custom-profile-data/assistant-state.json" }) {
            assertThatThrownBy(() -> workspace.readTextFile(path)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> workspace.listFiles("custom-profile-data", 100)).isInstanceOf(IllegalArgumentException.class);
        assertThat(workspace.listFiles(".", 100)).containsExactly(".env.example", "source.java");
        assertThat(workspace.readTextFile(".env.example").content()).isEqualTo("template");
        assertThat(workspace.readTextFile("source.java").content()).isEqualTo("source");
        assertThat(workspace.resolveSafePath("data/approved-write.txt")).isEqualTo(root.resolve("data/approved-write.txt"));
        assertThat(Files.readString(configuredData.resolve("assistant-state.json"))).isEqualTo("private conversation");
    }

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void windowsJunctionCannotExposeOrWriteOutsideWorkspace() throws Exception {
        Path workspaceRoot = Files.createDirectory(root.resolve("workspace"));
        Path outside = Files.createDirectory(root.resolve("outside"));
        Files.writeString(outside.resolve("secret.txt"), "outside");
        Files.writeString(workspaceRoot.resolve("inside.txt"), "inside");
        Path junction = workspaceRoot.resolve("escape");
        String command = "New-Item -ItemType Junction -Path '" + junction.toString().replace("'", "''")
                + "' -Target '" + outside.toString().replace("'", "''") + "' -ErrorAction Stop | Out-Null";
        Process process = new ProcessBuilder("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command)
                .redirectErrorStream(true).start();
        if (!process.waitFor(15, java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new AssertionError("Temporary junction creation timed out.");
        }
        try {
            assertThat(process.exitValue()).as(new String(process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).isZero();
            AssistantProperties properties = new AssistantProperties();
            properties.setWorkspaceRoot(workspaceRoot.toString());
            WorkspaceService workspace = new WorkspaceService(properties);
            assertThatThrownBy(() -> workspace.readTextFile("escape/secret.txt")).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> workspace.resolveSafePath("escape/new.txt")).isInstanceOf(IllegalArgumentException.class);
            assertThat(workspace.listFiles(".", 200)).containsExactly("inside.txt");
            assertThat(Files.readString(outside.resolve("secret.txt"))).isEqualTo("outside");
        } finally {
            // Delete the link itself; never walk/delete through its target.
            Files.deleteIfExists(junction);
        }
    }

    private WorkspaceService workspace() {
        AssistantProperties properties = new AssistantProperties();
        properties.setWorkspaceRoot(root.toString());
        return new WorkspaceService(properties);
    }
}
