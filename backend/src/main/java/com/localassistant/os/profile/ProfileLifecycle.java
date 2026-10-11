package com.localassistant.os.profile;

import java.util.HashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/** Deletion waits for existing profile requests; idle lock entries are removed. */
public final class ProfileLifecycle {
    private static final HashMap<String, Entry> entries = new HashMap<>();
    private static final class Entry {
        final ReentrantReadWriteLock lock = new ReentrantReadWriteLock(true);
        int users;
    }
    private ProfileLifecycle() {}
    public static Lease acquire(String profile, boolean deletion) {
        Entry entry;
        synchronized (entries) { entry = entries.computeIfAbsent(profile, ignored -> new Entry()); entry.users++; }
        var lock = deletion ? entry.lock.writeLock() : entry.lock.readLock();
        lock.lock();
        return new Lease(profile, entry, lock);
    }
    public static final class Lease implements AutoCloseable {
        private final String profile;
        private final Entry entry;
        private final java.util.concurrent.locks.Lock lock;
        private boolean closed;
        private Lease(String profile, Entry entry, java.util.concurrent.locks.Lock lock) { this.profile = profile; this.entry = entry; this.lock = lock; }
        public void close() {
            if (closed) return; closed = true; lock.unlock();
            synchronized (entries) { if (--entry.users == 0) entries.remove(profile, entry); }
        }
    }
}
