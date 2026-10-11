package com.localassistant.os.store;

import static org.assertj.core.api.Assertions.*;
import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import java.nio.file.Path;
import java.util.Map;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StateStoreTest {
    @TempDir Path directory;
    private StateStore store() {
        var properties = new AssistantProperties(); properties.setDataDir(directory.toString());
        return new StateStore(new ProfilePaths(properties));
    }
    @Test void targetedReadsAreDefensiveAndSurviveReload() throws Exception {
        var store = store();
        var conversation = store.getOrCreateConversation("one");
        store.addMessage("one", "user", "hello");
        var nested = new ArrayList<>(java.util.List.of("original"));
        store.addAction("remember", Map.of("nested", nested), "test");
        nested.add("outside mutation");
        var returned = store.actions();
        ((java.util.List<Object>) returned.getFirst().arguments().get("nested")).add("returned mutation");
        assertThat(store.actions().getFirst().arguments().get("nested")).isEqualTo(java.util.List.of("original"));
        assertThat(conversation.messages()).isEmpty();
        assertThatThrownBy(() -> store.conversation("one").orElseThrow().messages().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(store.conversationSummaries().getFirst()).containsEntry("messageCount", 1);
        store.clearCurrentCache();
        assertThat(store.conversation("one").orElseThrow().messages()).hasSize(1);
    }
    @Test void targetedReadsDoNotCrossProfiles() throws Exception {
        var store = store();
        try {
            ProfileContext.set("first"); store.addMemory("first only", "fact");
            ProfileContext.set("second"); assertThat(store.memories()).isEmpty();
            ProfileContext.set("first"); assertThat(store.memories()).hasSize(1);
        } finally { ProfileContext.clear(); }
    }
    @Test void failedPersistenceDoesNotPublishUncommittedState() throws Exception {
        var store = store(); store.memories();
        java.nio.file.Files.createDirectory(directory.resolve("assistant-state.json.tmp"));
        assertThatThrownBy(() -> store.addMemory("must not appear", "fact")).isInstanceOf(java.io.IOException.class);
        assertThat(store.memories()).isEmpty();
    }
}
