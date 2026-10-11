package com.localassistant.os.store;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.model.AppState;
import com.localassistant.os.model.AssistantAction;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.model.Memory;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.springframework.stereotype.Component;

@Component
public class StateStore {
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private final ProfilePaths profilePaths;
    private final Map<String, AppState> states = new HashMap<>();

    public StateStore(ProfilePaths profilePaths) {
        this.profilePaths = profilePaths;
    }

    private AppState state() {
        return states.computeIfAbsent(ProfileContext.currentId(), ignored -> load());
    }

    private AppState load() {
        Path filePath = profilePaths.file("assistant-state.json");
        AppState empty = AppState.empty();
        try {
        Files.createDirectories(filePath.getParent());
        if (Files.notExists(filePath)) {
                persist(empty);
                return empty;
        }

        try (var reader = Files.newBufferedReader(filePath, StandardCharsets.UTF_8)) {
            AppState parsed = gson.fromJson(reader, AppState.class);
            if (parsed == null || parsed.version() != 1) {
                throw new IllegalStateException("Unsupported or invalid assistant state file.");
            }
                return parsed;
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not load assistant state.", error);
        }
    }

    public synchronized AppState snapshot() {
        return gson.fromJson(gson.toJson(state()), AppState.class);
    }

    public synchronized List<Memory> memories() { return List.copyOf(state().memories()); }

    public synchronized List<AssistantAction> actions() {
        return state().actions().stream().map(this::copyAction).toList();
    }

    private AssistantAction copyAction(AssistantAction action) {
        return gson.fromJson(gson.toJson(action), AssistantAction.class);
    }

    private Conversation copyConversation(Conversation conversation) {
        return new Conversation(conversation.id(), conversation.title(), List.copyOf(conversation.messages()),
                conversation.createdAt(), conversation.updatedAt());
    }

    public synchronized Optional<Conversation> conversation(String id) {
        return state().conversations().stream().filter(item -> item.id().equals(id)).findFirst().map(this::copyConversation);
    }

    public synchronized List<Map<String, Object>> conversationSummaries() {
        return state().conversations().stream().map(item -> Map.<String, Object>of(
                "id", item.id(), "title", item.title(), "createdAt", item.createdAt(),
                "updatedAt", item.updatedAt(), "messageCount", item.messages().size())).toList();
    }

    public synchronized void clearCurrentCache() {
        states.remove(ProfileContext.currentId());
    }

    public synchronized Conversation getOrCreateConversation(String requestedId) throws IOException {
        if (requestedId != null && !requestedId.isBlank()) {
            return state().conversations().stream()
                    .filter(conversation -> conversation.id().equals(requestedId))
                    .findFirst()
                    .map(this::copyConversation)
                    .orElseGet(() -> createConversation(requestedId));
        }
        return createConversation(UUID.randomUUID().toString());
    }

    private Conversation createConversation(String id) {
        String now = Instant.now().toString();
        Conversation conversation = new Conversation(id, "New conversation", new ArrayList<>(), now, now);
        AppState state = state();
        var conversations = new ArrayList<>(state.conversations());
        conversations.add(conversation);
        commitUnchecked(new AppState(1, conversations, state.memories(), state.actions()));
        return copyConversation(conversation);
    }

    public synchronized ConversationMessage addMessage(String conversationId, String role, String content)
            throws IOException {
        String now = Instant.now().toString();
        ConversationMessage message = new ConversationMessage(UUID.randomUUID().toString(), role, content, now);
        var conversations = new ArrayList<Conversation>();
        boolean found = false;
        AppState state = state();
        for (Conversation conversation : state.conversations()) {
            if (!conversation.id().equals(conversationId)) {
                conversations.add(conversation);
                continue;
            }
            found = true;
            var messages = new ArrayList<>(conversation.messages());
            messages.add(message);
            String title = messages.size() == 1
                    ? content.substring(0, Math.min(72, content.length()))
                    : conversation.title();
            conversations.add(new Conversation(
                    conversation.id(), title, messages, conversation.createdAt(), now));
        }
        if (!found) {
            throw new IllegalArgumentException("Conversation not found.");
        }
        commit(new AppState(1, conversations, state.memories(), state.actions()));
        return message;
    }

    public synchronized Memory addMemory(String content, String category) throws IOException {
        String now = Instant.now().toString();
        Memory memory = new Memory(UUID.randomUUID().toString(), content, category, now, now);
        AppState state = state();
        var memories = new ArrayList<>(state.memories());
        memories.add(memory);
        commit(new AppState(1, state.conversations(), memories, state.actions()));
        return memory;
    }

    public synchronized boolean deleteMemory(String id) throws IOException {
        AppState state = state();
        var memories = new ArrayList<>(state.memories());
        boolean deleted = memories.removeIf(memory -> memory.id().equals(id));
        if (deleted) {
            commit(new AppState(1, state.conversations(), memories, state.actions()));
        }
        return deleted;
    }

    public synchronized AssistantAction addAction(
            String kind, Map<String, Object> arguments, String reason) throws IOException {
        String now = Instant.now().toString();
        AssistantAction action = new AssistantAction(
                UUID.randomUUID().toString(), kind, "pending", Map.copyOf(arguments), reason,
                null, null, now, now);
        AppState state = state();
        var actions = new ArrayList<>(state.actions());
        actions.add(copyAction(action));
        commit(new AppState(1, state.conversations(), state.memories(), actions));
        return copyAction(action);
    }

    public synchronized AssistantAction updateAction(String id, UnaryOperator<AssistantAction> update)
            throws IOException {
        var actions = new ArrayList<AssistantAction>();
        AssistantAction updated = null;
        AppState state = state();
        for (AssistantAction action : state.actions()) {
            if (action.id().equals(id)) {
                updated = update.apply(copyAction(action));
                updated = new AssistantAction(
                        updated.id(), updated.kind(), updated.status(), updated.arguments(), updated.reason(),
                        updated.result(), updated.error(), updated.createdAt(), Instant.now().toString());
                updated = copyAction(updated);
                actions.add(updated);
            } else {
                actions.add(action);
            }
        }
        if (updated == null) {
            throw new IllegalArgumentException("Action not found.");
        }
        commit(new AppState(1, state.conversations(), state.memories(), actions));
        return copyAction(updated);
    }

    private void commitUnchecked(AppState value) {
        try { commit(value); }
        catch (IOException error) { throw new IllegalStateException("Could not persist assistant state.", error); }
    }

    private void commit(AppState value) throws IOException {
        persist(value);
        states.put(ProfileContext.currentId(), value);
    }

    private void persist(AppState state) throws IOException {
        Path filePath = profilePaths.file("assistant-state.json");
        Files.createDirectories(filePath.getParent());
        Path temporary = filePath.resolveSibling(filePath.getFileName() + ".tmp");
        Files.writeString(temporary, gson.toJson(state), StandardCharsets.UTF_8);
        try {
            Files.move(temporary, filePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(temporary, filePath, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
