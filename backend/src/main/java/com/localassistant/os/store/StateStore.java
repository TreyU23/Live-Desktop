package com.localassistant.os.store;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.model.AppState;
import com.localassistant.os.model.AssistantAction;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.model.Memory;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class StateStore {
    private static final Logger kLog = LoggerFactory.getLogger(StateStore.class);
    /** Finished actions kept per profile; older ones are dropped so state and polls stay bounded. */
    static final int MAX_FINISHED_ACTIONS = 1_000;

    private final Gson gson = new GsonBuilder().create();
    private final ProfilePaths profilePaths;
    private final Map<String, AppState> states = new ConcurrentHashMap<>();
    /** One lock per profile, so a slow commit in one profile never blocks requests for another. */
    private final Map<String, ReentrantLock> locks = new ConcurrentHashMap<>();
    /** Taken while deciding about a profile that has no lock yet; see {@link #locked}. */
    private final ReentrantLock newProfileLock = new ReentrantLock();

    /** Thrown for a conversation id the client may not use; maps to HTTP 400. */
    public static final class InvalidConversationIdException extends IllegalArgumentException {
        public InvalidConversationIdException() {
            super("Conversation not found.");
        }
    }

    public StateStore(ProfilePaths profilePaths) {
        this.profilePaths = profilePaths;
    }

    private interface IoAction<T> { T run() throws IOException; }

    private <T> T locked(IoAction<T> action) throws IOException {
        String profile = ProfileContext.currentId();
        ReentrantLock lock = locks.get(profile);
        if (lock == null) {
            // Profiles without a folder run under one shared lock, so ids that never save anything
            // don't each add a lock (issue #18). Deciding under that lock also means a profile's
            // first write finishes before any later request switches to its own lock.
            newProfileLock.lock();
            try {
                if (!profilePaths.currentExists()) return action.run();
                lock = locks.computeIfAbsent(profile, ignored -> new ReentrantLock());
            } finally {
                newProfileLock.unlock();
            }
        }
        lock.lock();
        try {
            return action.run();
        } finally {
            lock.unlock();
        }
    }

    private <T> T lockedUnchecked(IoAction<T> action) {
        try {
            return locked(action);
        } catch (IOException error) {
            throw new IllegalStateException("Could not persist assistant state.", error);
        }
    }

    private AppState state() {
        AppState cached = states.get(ProfileContext.currentId());
        if (cached != null) return cached;
        // Nothing is saved for a profile without a folder; don't cache it, so made-up ids can't grow this map.
        if (!profilePaths.currentExists()) return AppState.empty();
        return states.computeIfAbsent(ProfileContext.currentId(), ignored -> load());
    }

    private AppState load() {
        Path filePath = profilePaths.file("assistant-state.json");
        // Reading creates nothing on disk; the first write does.
        if (Files.notExists(filePath)) return AppState.empty();

        AppState parsed;
        try {
            parsed = gson.fromJson(Files.readString(filePath, StandardCharsets.UTF_8), AppState.class);
        } catch (CharacterCodingException | JsonParseException damaged) {
            // Truncated or garbled (for example after a power loss): keep it for inspection and start empty.
            return moveAsideAndStartEmpty(filePath, damaged);
        } catch (IOException error) {
            // Not a damaged file but one that can't be read right now (locked, permissions): retry later.
            throw new IllegalStateException("Could not load assistant state.", error);
        }
        if (parsed == null) return moveAsideAndStartEmpty(filePath, null);
        if (parsed.version() != 1) {
            // Possibly written by a newer Live Desktop; never move it aside or overwrite it.
            throw new IllegalStateException("Unsupported assistant state file version.");
        }
        // A hand-edited file may leave out a list; treat it as empty. Older files still hold the full
        // content of finished writes; shed it as the state loads.
        return new AppState(1, nonNull(parsed.conversations()), nonNull(parsed.memories()),
                nonNull(parsed.actions()).stream().map(AssistantAction::compacted)
                        .collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
    }

    private static <T> ArrayList<T> nonNull(List<T> values) {
        var result = new ArrayList<T>();
        if (values != null) for (T value : values) if (value != null) result.add(value);
        return result;
    }

    /**
     * Renames an unreadable state file to assistant-state.json.corrupt-&lt;UTC time&gt; so the next save cannot
     * overwrite it, and starts the profile empty. If it can't be moved, loading fails instead: starting empty
     * would let the next write destroy the only copy.
     */
    private AppState moveAsideAndStartEmpty(Path filePath, Exception cause) {
        String stamp = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS'Z'")
                .withZone(java.time.ZoneOffset.UTC).format(Instant.now());
        Path aside = filePath.resolveSibling(filePath.getFileName() + ".corrupt-" + stamp);
        try {
            Files.move(filePath, aside);
        } catch (IOException error) {
            throw new IllegalStateException("Assistant state is damaged and could not be set aside.", error);
        }
        kLog.warn("Assistant state for profile {} was unreadable; moved it to {} and started empty.",
                ProfileContext.currentId(), aside.getFileName(), cause);
        return AppState.empty();
    }

    public AppState snapshot() {
        return lockedUnchecked(() -> {
            return gson.fromJson(gson.toJson(state()), AppState.class);
        });
    }

    public List<Memory> memories() {
        return lockedUnchecked(() -> List.copyOf(state().memories()));
    }

    public List<AssistantAction> actions() {
        return lockedUnchecked(() -> {
            return state().actions().stream().map(this::copyAction).toList();
        });
    }

    private AssistantAction copyAction(AssistantAction action) {
        return gson.fromJson(gson.toJson(action), AssistantAction.class);
    }

    private Conversation copyConversation(Conversation conversation) {
        return new Conversation(conversation.id(), conversation.title(), List.copyOf(conversation.messages()),
                conversation.createdAt(), conversation.updatedAt());
    }

    public Optional<Conversation> conversation(String id) {
        return lockedUnchecked(() -> {
            return state().conversations().stream().filter(item -> item.id().equals(id)).findFirst().map(this::copyConversation);
        });
    }

    public List<Map<String, Object>> conversationSummaries() {
        return lockedUnchecked(() -> {
            return state().conversations().stream().map(item -> Map.<String, Object>of(
                    "id", item.id(), "title", item.title(), "createdAt", item.createdAt(),
                    "updatedAt", item.updatedAt(), "messageCount", item.messages().size())).toList();
        });
    }

    public void clearCurrentCache() {
        lockedUnchecked(() -> {
            states.remove(ProfileContext.currentId());
        return null;
        });
    }

    public Conversation getOrCreateConversation(String requestedId) throws IOException {
        return locked(() -> {
            if (requestedId != null && !requestedId.isBlank()) {
                var existing = state().conversations().stream()
                        .filter(conversation -> conversation.id().equals(requestedId))
                        .findFirst()
                        .map(this::copyConversation);
                if (existing.isPresent()) return existing.get();
                if (!isConversationId(requestedId)) throw new InvalidConversationIdException();
            }
            // Unknown and missing ids both start a conversation under a server-made id, so a client
            // can't choose the ids stored in state (issue #18). The response carries the new id.
            return createConversation(UUID.randomUUID().toString());
        });
    }

    /**
     * The conversation a chat turn should answer in, without saving anything: the stored one, or an unsaved new
     * one under a server-made id when the id is missing or unknown. {@link #appendTurn} saves it with the first
     * completed turn, so a request that fails leaves no empty or one-sided conversation behind.
     */
    public Conversation conversationForTurn(String requestedId) throws IOException {
        return locked(() -> {
            if (requestedId != null && !requestedId.isBlank()) {
                var existing = state().conversations().stream()
                        .filter(conversation -> conversation.id().equals(requestedId))
                        .findFirst()
                        .map(this::copyConversation);
                if (existing.isPresent()) return existing.get();
                if (!isConversationId(requestedId)) throw new InvalidConversationIdException();
            }
            String now = Instant.now().toString();
            return new Conversation(UUID.randomUUID().toString(), "New conversation", List.of(), now, now);
        });
    }

    /**
     * Saves one finished chat turn (the user's message and the reply) in a single commit. A new conversation from
     * {@link #conversationForTurn} is created here; an existing one that was deleted meanwhile is not brought back.
     * Returns the saved reply.
     */
    public ConversationMessage appendTurn(Conversation turn, String userContent, String assistantContent)
            throws IOException {
        return locked(() -> {
            String now = Instant.now().toString();
            ConversationMessage user = new ConversationMessage(UUID.randomUUID().toString(), "user", userContent, now);
            ConversationMessage reply = new ConversationMessage(UUID.randomUUID().toString(), "assistant", assistantContent, now);
            AppState state = state();
            var conversations = new ArrayList<Conversation>();
            boolean found = false;
            for (Conversation conversation : state.conversations()) {
                if (!conversation.id().equals(turn.id())) {
                    conversations.add(conversation);
                    continue;
                }
                found = true;
                conversations.add(withTurn(conversation, user, reply, now));
            }
            if (!found) {
                // Only a conversation that was never saved may start here; a deleted one stays deleted.
                if (!turn.messages().isEmpty()) throw new IllegalArgumentException("Conversation not found.");
                conversations.add(withTurn(new Conversation(turn.id(), turn.title(), List.of(), now, now), user, reply, now));
            }
            commit(new AppState(1, conversations, state.memories(), state.actions()));
            return reply;
        });
    }

    private static Conversation withTurn(Conversation conversation, ConversationMessage user, ConversationMessage reply, String now) {
        var messages = new ArrayList<>(conversation.messages());
        String title = messages.isEmpty()
                ? user.content().substring(0, Math.min(72, user.content().length()))
                : conversation.title();
        messages.add(user);
        messages.add(reply);
        return new Conversation(conversation.id(), title, messages, conversation.createdAt(), now);
    }

    static boolean isConversationId(String value) {
        return value.length() == 36 && CONVERSATION_ID.matcher(value).matches();
    }

    private static final java.util.regex.Pattern CONVERSATION_ID =
            java.util.regex.Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private Conversation createConversation(String id) {
        String now = Instant.now().toString();
        Conversation conversation = new Conversation(id, "New conversation", new ArrayList<>(), now, now);
        AppState state = state();
        var conversations = new ArrayList<>(state.conversations());
        conversations.add(conversation);
        commitUnchecked(new AppState(1, conversations, state.memories(), state.actions()));
        return copyConversation(conversation);
    }

    public ConversationMessage addMessage(String conversationId, String role, String content)
            throws IOException {
        return locked(() -> {
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
        });
    }

    /**
     * Permanently removes one conversation and its messages. The rewritten state file replaces the old one
     * atomically before the cache is updated, so no copy of the conversation stays in the state file or in
     * memory. Returns false when no conversation has that id.
     */
    public boolean deleteConversation(String id) throws IOException {
        return locked(() -> {
            AppState state = state();
            var conversations = new ArrayList<>(state.conversations());
            if (!conversations.removeIf(conversation -> conversation.id().equals(id))) return false;
            commit(new AppState(1, conversations, state.memories(), state.actions()));
            return true;
        });
    }

    public Memory addMemory(String content, String category) throws IOException {
        return locked(() -> {
            String now = Instant.now().toString();
            Memory memory = new Memory(UUID.randomUUID().toString(), content, category, now, now);
            AppState state = state();
            var memories = new ArrayList<>(state.memories());
            memories.add(memory);
            commit(new AppState(1, state.conversations(), memories, state.actions()));
            return memory;
        });
    }

    public boolean deleteMemory(String id) throws IOException {
        return locked(() -> {
            AppState state = state();
            var memories = new ArrayList<>(state.memories());
            boolean deleted = memories.removeIf(memory -> memory.id().equals(id));
            if (deleted) {
                commit(new AppState(1, state.conversations(), memories, state.actions()));
            }
            return deleted;
        });
    }

    public AssistantAction addAction(
            String kind, Map<String, Object> arguments, String reason) throws IOException {
        return locked(() -> {
            String now = Instant.now().toString();
            AssistantAction action = new AssistantAction(
                    UUID.randomUUID().toString(), kind, "pending", Map.copyOf(arguments), reason,
                    null, null, now, now);
            AppState state = state();
            var actions = new ArrayList<>(state.actions());
            actions.add(copyAction(action));
            pruneFinished(actions);
            commit(new AppState(1, state.conversations(), state.memories(), actions));
            return copyAction(action);
        });
    }

    public AssistantAction updateAction(String id, UnaryOperator<AssistantAction> update)
            throws IOException {
        return locked(() -> {
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
        });
    }

    private static void pruneFinished(List<AssistantAction> actions) {
        long finished = actions.stream().filter(action -> !"pending".equals(action.status())
                && !"approved".equals(action.status())).count();
        for (var iterator = actions.iterator(); finished > MAX_FINISHED_ACTIONS && iterator.hasNext();) {
            AssistantAction candidate = iterator.next();
            if (!"pending".equals(candidate.status()) && !"approved".equals(candidate.status())) {
                iterator.remove();
                finished--;
            }
        }
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
        profilePaths.prepareCurrentDirectory();
        Path temporary = filePath.resolveSibling(filePath.getFileName() + ".tmp");
        // Flush to disk before the move, so a power loss leaves the old file or the whole new one, not a stub.
        try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE)) {
            ByteBuffer bytes = ByteBuffer.wrap(gson.toJson(state).getBytes(StandardCharsets.UTF_8));
            while (bytes.hasRemaining()) channel.write(bytes);
            channel.force(true);
        }
        try {
            Files.move(temporary, filePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(temporary, filePath, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
