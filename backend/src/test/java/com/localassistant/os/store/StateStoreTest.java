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
    @Test void stateFileIsCompactJson() throws Exception {
        var store = store();
        store.addMemory("tiny", "fact");
        assertThat(java.nio.file.Files.readString(directory.resolve("assistant-state.json"))).doesNotContain("\n");
    }
    @Test void finishedFileWritesKeepOnlyAHashOfTheirContent() throws Exception {
        var store = store();
        var action = store.addAction("workspace_write_file", Map.of("path", "a.txt", "content", "hello"), "test");
        var done = store.updateAction(action.id(), a -> new com.localassistant.os.model.AssistantAction(
                a.id(), a.kind(), "completed", a.arguments(), a.reason(), null, null, a.createdAt(), a.updatedAt()).compacted());
        assertThat(done.arguments()).doesNotContainKey("content")
                .containsEntry("contentSha256", com.localassistant.os.model.AssistantAction.sha256("hello"))
                .containsEntry("contentBytes", 5.0).containsEntry("path", "a.txt");
        var pending = store.addAction("workspace_write_file", Map.of("path", "b.txt", "content", "keep"), "test");
        assertThat(pending.arguments()).containsEntry("content", "keep");
    }
    @Test void oldStateFilesShedFinishedWriteContentOnLoad() throws Exception {
        java.nio.file.Files.writeString(directory.resolve("assistant-state.json"), "{\"version\":1,\"conversations\":[],\"memories\":[],\"actions\":["
                + "{\"id\":\"1\",\"kind\":\"workspace_write_file\",\"status\":\"completed\",\"arguments\":{\"path\":\"a.txt\",\"content\":\"old content\"},\"reason\":\"r\",\"createdAt\":\"t\",\"updatedAt\":\"t\"},"
                + "{\"id\":\"2\",\"kind\":\"workspace_write_file\",\"status\":\"pending\",\"arguments\":{\"path\":\"b.txt\",\"content\":\"waiting\"},\"reason\":\"r\",\"createdAt\":\"t\",\"updatedAt\":\"t\"}]}");
        var actions = store().actions();
        assertThat(actions.get(0).arguments()).doesNotContainKey("content").containsKey("contentSha256");
        assertThat(actions.get(1).arguments()).containsEntry("content", "waiting");
    }
    @Test void finishedHistoryIsCappedButPendingActionsSurvive() throws Exception {
        var store = store();
        var pending = store.addAction("remember", Map.of("content", "keep me", "category", "fact"), "pending");
        for (int i = 0; i < StateStore.MAX_FINISHED_ACTIONS + 5; i++) {
            var action = store.addAction("remember", Map.of("content", "m" + i, "category", "fact"), "x");
            store.updateAction(action.id(), a -> new com.localassistant.os.model.AssistantAction(
                    a.id(), a.kind(), "rejected", a.arguments(), a.reason(), null, null, a.createdAt(), a.updatedAt()));
        }
        store.addAction("remember", Map.of("content", "trigger", "category", "fact"), "x");
        var all = store.actions();
        assertThat(all.stream().filter(a -> !a.status().equals("pending")).count()).isEqualTo(StateStore.MAX_FINISHED_ACTIONS);
        assertThat(all).extracting(a -> a.id()).contains(pending.id());
    }
}
