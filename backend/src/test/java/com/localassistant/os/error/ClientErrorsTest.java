package com.localassistant.os.error;

import static org.assertj.core.api.Assertions.assertThat;

import com.localassistant.os.agent.OpenAiAgent;
import com.localassistant.os.profile.ProfileLifecycle;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ClientErrorsTest {
    @Test
    void passesThroughMessagesLiveDesktopWrote() {
        var described = ClientErrors.describe(new IllegalArgumentException("Path is outside the configured workspace."));
        assertThat(described.code()).isEqualTo("invalid_request");
        assertThat(described.message()).isEqualTo("Path is outside the configured workspace.");

        assertThat(ClientErrors.describe(new IllegalStateException("iCloud Calendar returned HTTP 401.")).code())
                .isEqualTo("unavailable");
        assertThat(ClientErrors.describe(new IOException("Native radio bridge disconnected.")).code())
                .isEqualTo("io_error");
        assertThat(ClientErrors.describe(new OpenAiAgent.AgentDeadlineException()).code()).isEqualTo("deadline_exceeded");
        assertThat(ClientErrors.describe(new ProfileLifecycle.ProfileDeletedException()).code()).isEqualTo("profile_deleted");
    }

    @Test
    void hidesFileSystemErrorsThatNamePaths() {
        Path missing = Path.of(System.getProperty("java.io.tmpdir"), "live-desktop-secret-dir", "missing.txt");
        NoSuchFileException error = null;
        try {
            Files.readString(missing);
        } catch (NoSuchFileException thrown) {
            error = thrown;
        } catch (IOException other) {
            throw new AssertionError(other);
        }
        var described = ClientErrors.describe(error);
        assertThat(described.code()).isEqualTo("internal_error");
        assertThat(described.message()).doesNotContain("live-desktop-secret-dir").contains("ref ");
        assertThat(described.body()).containsEntry("code", "internal_error").containsKey("error");
    }

    @Test
    void hidesJdkMessagesEvenWhenTheTypeIsCurated() {
        // Thrown from a java.* frame, so the message isn't one Live Desktop wrote.
        IllegalArgumentException fromJdk = null;
        try {
            Integer.parseInt("C:\\Users\\someone\\secret");
        } catch (NumberFormatException thrown) {
            fromJdk = thrown;
        }
        assertThat(ClientErrors.describe(fromJdk).message()).doesNotContain("secret");

        IllegalStateException bare = new IllegalStateException("C:\\Users\\someone\\secret");
        bare.setStackTrace(new StackTraceElement[] {new StackTraceElement("java.util.Foo", "bar", null, 1)});
        assertThat(ClientErrors.describe(bare).message()).doesNotContain("secret");
    }

    @Test
    void hidesUnknownExceptionsAndBlankMessages() {
        assertThat(ClientErrors.describe(new RuntimeException("401 Incorrect API key provided: sk-abc")).message())
                .doesNotContain("sk-abc");
        assertThat(ClientErrors.describe(new IllegalArgumentException()).code()).isEqualTo("internal_error");
    }
}
