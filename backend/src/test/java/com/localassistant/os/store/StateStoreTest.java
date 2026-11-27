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
        var conversation = store.getOrCreateConversation(null);
        String id = conversation.id();
        store.addMessage(id, "user", "hello");
        var nested = new ArrayList<>(java.util.List.of("original"));
        store.addAction("remember", Map.of("nested", nested), "test");
        nested.add("outside mutation");
        var returned = store.actions();
        ((java.util.List<Object>) returned.getFirst().arguments().get("nested")).add("returned mutation");
        assertThat(store.actions().getFirst().arguments().get("nested")).isEqualTo(java.util.List.of("original"));
        assertThat(conversation.messages()).isEmpty();
        assertThatThrownBy(() -> store.conversation(id).orElseThrow().messages().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(store.conversationSummaries().getFirst()).containsEntry("messageCount", 1);
        store.clearCurrentCache();
        assertThat(store.conversation(id).orElseThrow().messages()).hasSize(1);
    }
    @Test void targetedReadsDoNotCrossProfiles() throws Exception {
        var store = store();
        try {
            ProfileContext.set(FIRST); store.addMemory("first only", "fact");
            ProfileContext.set(SECOND); assertThat(store.memories()).isEmpty();
            ProfileContext.set(FIRST); assertThat(store.memories()).hasSize(1);
        } finally { ProfileContext.clear(); }
    }
    private static final String FIRST = "00000000_0000_4000_8000_00000000000a";
    private static final String SECOND = "00000000_0000_4000_8000_00000000000b";

    @Test void readsForAProfileWithoutAFolderLeaveNothingBehind() throws Exception {
        var store = store();
        try {
            ProfileContext.set(SECOND);
            assertThat(store.memories()).isEmpty();
            assertThat(store.conversationSummaries()).isEmpty();
            assertThat(java.nio.file.Files.exists(directory.resolve("profiles"))).isFalse();
            store.addMemory("now it exists", "fact");
            assertThat(java.nio.file.Files.isRegularFile(directory.resolve("profiles").resolve(SECOND).resolve("assistant-state.json"))).isTrue();
        } finally { ProfileContext.clear(); }
        store.memories();
        assertThat(java.nio.file.Files.exists(directory.resolve("assistant-state.json"))).isFalse();
    }
    @Test void clientsCannotChooseConversationIds() throws Exception {
        var store = store();
        var made = store.getOrCreateConversation("00000000-0000-4000-8000-000000000123");
        assertThat(made.id()).isNotEqualTo("00000000-0000-4000-8000-000000000123");
        assertThat(store.getOrCreateConversation(made.id()).id()).isEqualTo(made.id());
        assertThatThrownBy(() -> store.getOrCreateConversation("../../evil"))
                .isInstanceOf(StateStore.InvalidConversationIdException.class);
        assertThat(store.conversationSummaries()).hasSize(1);
    }
    @Test void chatTurnsAreSavedOnlyWhenTheyComplete() throws Exception {
        var store = store();
        // A new conversation is only a draft until its first turn completes.
        var draft = store.conversationForTurn(null);
        assertThat(store.conversationSummaries()).isEmpty();
        assertThat(store.conversationForTurn("00000000-0000-4000-8000-000000000123").id())
                .isNotEqualTo("00000000-0000-4000-8000-000000000123");
        assertThatThrownBy(() -> store.conversationForTurn("../../evil"))
                .isInstanceOf(StateStore.InvalidConversationIdException.class);

        var reply = store.appendTurn(draft, "first question", "first answer");
        assertThat(reply.role()).isEqualTo("assistant");
        var saved = store.conversationForTurn(draft.id());
        assertThat(saved.title()).isEqualTo("first question");
        assertThat(saved.messages()).extracting(message -> message.role() + ":" + message.content())
                .containsExactly("user:first question", "assistant:first answer");

        store.appendTurn(saved, "second", "again");
        assertThat(store.conversation(draft.id()).orElseThrow().messages()).hasSize(4);
        assertThat(store.conversationSummaries()).hasSize(1);

        // A conversation deleted while its reply was running is not brought back.
        var current = store.conversation(draft.id()).orElseThrow();
        assertThat(store.deleteConversation(draft.id())).isTrue();
        assertThatThrownBy(() -> store.appendTurn(current, "late", "reply"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(store.conversationSummaries()).isEmpty();
    }
    @Test void deletedConversationsLeaveNothingInMemoryOrOnDisk() throws Exception {
        var store = store();
        var keep = store.getOrCreateConversation(null);
        var gone = store.getOrCreateConversation(null);
        store.addMessage(keep.id(), "user", "keep this");
        store.addMessage(gone.id(), "user", "unique-secret-phrase");
        store.addMessage(gone.id(), "assistant", "reply to unique-secret-phrase");
        assertThat(store.deleteConversation(gone.id())).isTrue();
        assertThat(store.deleteConversation(gone.id())).isFalse();
        assertThat(store.conversation(gone.id())).isEmpty();
        assertThat(store.conversationSummaries()).hasSize(1);
        Path file = directory.resolve("assistant-state.json");
        assertThat(java.nio.file.Files.readString(file)).doesNotContain("unique-secret-phrase").doesNotContain(gone.id()).contains("keep this");
        assertThat(java.nio.file.Files.exists(directory.resolve("assistant-state.json.tmp"))).isFalse();
        store.clearCurrentCache();
        assertThat(store.conversation(gone.id())).isEmpty();
        assertThat(store.conversation(keep.id())).isPresent();
    }
    @Test void newProfileFoldersStopAtTheLimit() throws Exception {
        var store = store();
        var profiles = java.nio.file.Files.createDirectories(directory.resolve("profiles"));
        for (int i = 0; i < ProfilePaths.MAX_PROFILES; i++) {
            java.nio.file.Files.createDirectory(profiles.resolve(String.format("00000000_0000_4000_8000_%012x", i)));
        }
        try {
            ProfileContext.set("ffffffff_0000_4000_8000_000000000000");
            assertThatThrownBy(() -> store.addMemory("one too many", "fact")).hasMessageContaining("at most");
            ProfileContext.set("00000000_0000_4000_8000_000000000000");
            store.addMemory("existing profiles still save", "fact");
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

    // A damaged assistant-state.json must not take the profile down (issue #38).
    private Path stateFile() { return directory.resolve("assistant-state.json"); }
    private java.util.List<Path> asideFiles() throws Exception {
        try (var files = java.nio.file.Files.list(directory)) {
            return files.filter(path -> path.getFileName().toString().startsWith("assistant-state.json.corrupt-")).toList();
        }
    }

    @Test void missingListsLoadAsEmpty() throws Exception {
        java.nio.file.Files.writeString(stateFile(), "{\"version\":1,\"memories\":[{\"id\":\"m1\",\"content\":\"kept\",\"category\":\"fact\",\"createdAt\":\"t\",\"updatedAt\":\"t\"}]}");
        var store = store();
        assertThat(store.memories()).hasSize(1);
        assertThat(store.actions()).isEmpty();
        assertThat(store.conversationSummaries()).isEmpty();
        store.addAction("remember", Map.of("content", "x", "category", "fact"), "still works");
        assertThat(asideFiles()).isEmpty();
    }

    @Test void damagedFilesAreSetAsideAndTheProfileStartsEmpty() throws Exception {
        byte[][] damaged = {
            "{\"version\":1,\"conversations\":[".getBytes(java.nio.charset.StandardCharsets.UTF_8),
            new byte[0],
            "not json at all".getBytes(java.nio.charset.StandardCharsets.UTF_8),
            "{\"version\":1,\"actions\":\"oops\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8),
            new byte[]{'{', '"', (byte) 0xC3, (byte) 0x28, '"', '}'},
        };
        for (byte[] content : damaged) {
            for (Path old : asideFiles()) java.nio.file.Files.delete(old);
            java.nio.file.Files.write(stateFile(), content);
            var store = store();

            assertThat(store.memories()).isEmpty();
            assertThat(stateFile()).doesNotExist();
            assertThat(asideFiles()).hasSize(1);
            assertThat(java.nio.file.Files.readAllBytes(asideFiles().getFirst())).isEqualTo(content);
            // The failure is not repeated on every request, and the next write starts a clean file.
            store.addMemory("fresh start", "fact");
            assertThat(store().memories()).extracting(m -> m.content()).containsExactly("fresh start");
            assertThat(asideFiles()).hasSize(1);
            java.nio.file.Files.delete(stateFile());
        }
    }

    @Test void aFileFromAnotherVersionIsNeverMovedOrOverwritten() throws Exception {
        String future = "{\"version\":2,\"conversations\":[],\"memories\":[],\"actions\":[]}";
        java.nio.file.Files.writeString(stateFile(), future);
        var store = store();

        assertThatThrownBy(store::memories).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> store.addMemory("must not overwrite", "fact")).isInstanceOf(IllegalStateException.class);
        assertThat(java.nio.file.Files.readString(stateFile())).isEqualTo(future);
        assertThat(asideFiles()).isEmpty();
    }

    @Test void savingLeavesNoTemporaryFile() throws Exception {
        store().addMemory("saved", "fact");
        assertThat(stateFile()).exists();
        assertThat(directory.resolve("assistant-state.json.tmp")).doesNotExist();
    }
}
