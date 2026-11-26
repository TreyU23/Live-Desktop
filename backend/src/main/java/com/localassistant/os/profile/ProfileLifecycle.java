package com.localassistant.os.profile;

import java.util.HashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Per-profile request leases.
 *
 * <p>Every request holds a shared lease for its profile. Only profile deletion takes the exclusive
 * lock, and it does so from inside the operation (see {@link #exclusive}) rather than from the
 * request verb or path, so routing quirks cannot bypass it and ordinary DELETEs (a memory, a key,
 * an integration) never queue behind a long chat.
 *
 * <p>Long network calls (the assistant agent loop) can {@link #suspend} the current lease so a waiting
 * deletion does not block every later reader of the profile behind the fair lock. If the profile
 * was deleted while suspended, resuming throws {@link ProfileDeletedException}.
 */
public final class ProfileLifecycle {
    private static final HashMap<String, Entry> entries = new HashMap<>();
    private static final ThreadLocal<Lease> CURRENT = new ThreadLocal<>();

    private static final class Entry {
        final ReentrantReadWriteLock lock = new ReentrantReadWriteLock(true);
        int users;
        /** Incremented under the write lock each time the profile is deleted. */
        long generation;
    }

    @FunctionalInterface
    public interface IoAction {
        void run() throws java.io.IOException;
    }

    /** A suspended lease; closing it takes the shared lease back. */
    public interface Suspension extends AutoCloseable {
        @Override
        void close();
    }

    public static final class ProfileDeletedException extends IllegalStateException {
        public ProfileDeletedException() {
            super("This profile was deleted while the request was running.");
        }
    }

    private ProfileLifecycle() {}

    private static Entry retain(String profile) {
        synchronized (entries) {
            Entry entry = entries.computeIfAbsent(profile, ignored -> new Entry());
            entry.users++;
            return entry;
        }
    }

    private static void release(String profile, Entry entry) {
        synchronized (entries) {
            if (--entry.users == 0) entries.remove(profile, entry);
        }
    }

    /** Takes the shared lease for a request. The returned lease becomes this thread's current lease. */
    public static Lease acquire(String profile) {
        Entry entry = retain(profile);
        entry.lock.readLock().lock();
        Lease lease = new Lease(profile, entry, entry.generation);
        if (CURRENT.get() == null) CURRENT.set(lease);
        return lease;
    }

    /**
     * Runs a profile-destroying action under the exclusive lock. If this thread holds a shared lease
     * for the same profile it is released first (a read lock cannot be upgraded) and taken back
     * afterwards.
     */
    public static void exclusive(String profile, IoAction action) throws java.io.IOException {
        Lease current = CURRENT.get();
        boolean releasedOwn = current != null && current.held && current.profile.equals(profile);
        if (releasedOwn) current.unlock();
        Entry entry = retain(profile);
        try {
            entry.lock.writeLock().lock();
            try {
                entry.generation++;
                action.run();
            } finally {
                entry.lock.writeLock().unlock();
            }
        } finally {
            release(profile, entry);
            if (releasedOwn) current.relock(false);
        }
    }

    /**
     * Releases this thread's shared lease until the returned suspension is closed. Use around long
     * calls that do not touch profile state. Closing throws {@link ProfileDeletedException} if the
     * profile was deleted in the meantime.
     */
    /**
     * When a call made under {@link #suspend} fails and the profile was deleted meanwhile, closing the suspension
     * throws {@link ProfileDeletedException}, which Java attaches to the call's exception as suppressed. Callers rethrow
     * it before retrying or mapping the error, so the deletion always wins (issue #27).
     */
    public static void rethrowIfDeleted(Throwable error) {
        for (Throwable suppressed : error.getSuppressed()) {
            if (suppressed instanceof ProfileDeletedException deleted) throw deleted;
        }
    }

    public static Suspension suspend() {
        Lease current = CURRENT.get();
        if (current == null || !current.held) return () -> {};
        current.unlock();
        return () -> current.relock(true);
    }

    public static final class Lease implements AutoCloseable {
        private final String profile;
        private final Entry entry;
        private long generation;
        private boolean held = true;
        private boolean closed;
        /**
         * Sticky once a resume has seen a deletion. {@link #relock} advances {@link #generation} before it throws, so
         * without this a caller that swallowed or lost the first exception (a retry after an I/O error) would resume
         * cleanly on its next suspension and keep writing to the deleted profile (issue #27).
         */
        private boolean deleted;

        private Lease(String profile, Entry entry, long generation) {
            this.profile = profile;
            this.entry = entry;
            this.generation = generation;
        }

        private void unlock() {
            held = false;
            entry.lock.readLock().unlock();
        }

        private void relock(boolean failIfDeleted) {
            entry.lock.readLock().lock();
            held = true;
            long seen = generation;
            generation = entry.generation;
            if (failIfDeleted && (deleted || seen != entry.generation)) {
                deleted = true;
                throw new ProfileDeletedException();
            }
        }

        @Override
        public void close() {
            if (closed) return;
            closed = true;
            if (held) unlock();
            if (CURRENT.get() == this) CURRENT.remove();
            release(profile, entry);
        }
    }
}
