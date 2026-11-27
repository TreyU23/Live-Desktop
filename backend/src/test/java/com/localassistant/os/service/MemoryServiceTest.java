package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.model.Memory;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.store.StateStore;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MemoryServiceTest {
    @TempDir Path root;
    private MemoryService memories;

    @BeforeEach
    void setUp() throws Exception {
        AssistantProperties properties = new AssistantProperties();
        properties.setDataDir(root.resolve("data").toString());
        properties.setWorkspaceRoot(root.toString());
        memories = new MemoryService(new StateStore(new ProfilePaths(properties)));
        memories.add("Prefers dark themes", "preference");
        Thread.sleep(5);
        memories.add("Works on the Live Desktop dashboard", "project");
    }

    @Test
    void missingBlankAndTooShortQueriesAllListTheNewestMemories() {
        List<Memory> everything = memories.search(null, 10);

        assertThat(everything).hasSize(2);
        assertThat(everything.get(0).content()).isEqualTo("Works on the Live Desktop dashboard");
        for (String query : new String[]{"", "   ", "\t", "a", " a b "}) {
            assertThat(memories.search(query, 10)).as("query '%s'", query).isEqualTo(everything);
        }
    }

    @Test
    void realTermsStillFilterAndRank() {
        assertThat(memories.search("dark", 10)).extracting(Memory::content).containsExactly("Prefers dark themes");
        assertThat(memories.search("  DARK  themes ", 10)).hasSize(1);
        assertThat(memories.search("nothing-matches", 10)).isEmpty();
    }
}
