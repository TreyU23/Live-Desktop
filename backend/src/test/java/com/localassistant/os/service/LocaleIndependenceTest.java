package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.store.StateStore;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Input normalization must not depend on the JVM default locale (issue #47). */
class LocaleIndependenceTest {
    @TempDir Path root;
    private Locale original;

    @BeforeEach
    void useTurkishLocale() {
        original = Locale.getDefault();
        // Under tr-TR, "I".toLowerCase() is a dotless i, which no ASCII keyword contains.
        Locale.setDefault(Locale.forLanguageTag("tr-TR"));
    }

    @AfterEach
    void restoreLocale() {
        Locale.setDefault(original);
    }

    @Test
    void mediaActionAndProviderAreMatchedWithRootCasing() {
        WindowsBridgeClient bridge = mock(WindowsBridgeClient.class);
        when(bridge.request(any(), any())).thenReturn(Map.of("available", true));

        new WindowsMediaSessionService(bridge).control("SHUFFLE", "SPOTIFY");

        verify(bridge).request(eq("media.shuffle"), any());
    }

    @Test
    void memorySearchIgnoresCaseWithRootCasing() throws Exception {
        AssistantProperties properties = new AssistantProperties();
        properties.setDataDir(root.resolve("data").toString());
        properties.setWorkspaceRoot(root.toString());
        MemoryService memories = new MemoryService(new StateStore(new ProfilePaths(properties)));
        memories.add("Prefers indigo themes", "preference");

        assertThat(memories.search("INDIGO", 5)).hasSize(1);
    }
}
