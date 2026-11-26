package com.localassistant.os.web;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks conversations that have a chat reply in progress, so a second message to the same
 * conversation (another tab, window or client) is refused instead of interleaving with the first.
 * The UI's own send guard only covers one tab.
 */
final class InFlightConversations {
    private final Set<String> busy = ConcurrentHashMap.newKeySet();

    /**
     * Claims the conversation for one chat turn. Returns {@code null} if a turn is already in progress;
     * otherwise the caller must close the returned claim when the turn ends (try-with-resources skips
     * a {@code null} resource, so the result can go straight into one).
     */
    Claim tryClaim(String profileId, String conversationId) {
        String key = profileId + "/" + conversationId;
        return busy.add(key) ? new Claim(key) : null;
    }

    boolean isBusy(String profileId, String conversationId) {
        return busy.contains(profileId + "/" + conversationId);
    }

    final class Claim implements AutoCloseable {
        private final String key;
        private boolean released;

        private Claim(String key) {
            this.key = key;
        }

        @Override
        public synchronized void close() {
            if (!released) {
                released = true;
                busy.remove(key);
            }
        }
    }
}
