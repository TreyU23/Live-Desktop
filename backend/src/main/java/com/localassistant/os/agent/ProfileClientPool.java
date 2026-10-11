package com.localassistant.os.agent;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import jakarta.annotation.PreDestroy;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Component;

/** Profile-indexed client leases. Rotation never closes a client mid-request. */
@Component
public final class ProfileClientPool {
    private final LinkedHashMap<String, Entry> entries = new LinkedHashMap<>(16, .75f, true);
    private final HashSet<Entry> active = new HashSet<>();
    private boolean closed;
    private final java.util.function.Function<String, OpenAIClient> factory;
    public ProfileClientPool() { this(key -> OpenAIOkHttpClient.builder().apiKey(key).build()); }
    ProfileClientPool(java.util.function.Function<String, OpenAIClient> factory) { this.factory = factory; }
    private static final class Entry {
        final String fingerprint;
        final OpenAIClient client;
        int users;
        boolean retired;
        Entry(String fingerprint, OpenAIClient client) { this.fingerprint = fingerprint; this.client = client; }
    }
    public synchronized Lease acquire(String profile, String key) {
        if (closed) throw new IllegalStateException("Assistant is shutting down.");
        String fingerprint;
        try { fingerprint = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException(error); }
        Entry entry = entries.get(profile);
        if (entry != null && !entry.fingerprint.equals(fingerprint)) { invalidate(profile); entry = null; }
        if (entry == null) {
            entry = new Entry(fingerprint, factory.apply(key));
            entries.put(profile, entry);
            while (entries.size() > 16) invalidate(entries.keySet().iterator().next());
        }
        entry.users++; active.add(entry);
        return new Lease(entry);
    }
    public synchronized void invalidate(String profile) {
        Entry entry = entries.remove(profile);
        if (entry != null) { entry.retired = true; if (entry.users == 0) entry.client.close(); }
    }
    public final class Lease implements AutoCloseable {
        private Entry entry;
        private Lease(Entry entry) { this.entry = entry; }
        public OpenAIClient client() { return entry.client; }
        @Override public void close() {
            synchronized (ProfileClientPool.this) {
                if (entry == null) return;
                if (--entry.users == 0) { active.remove(entry); if (entry.retired) entry.client.close(); }
                entry = null;
            }
        }
    }
    @PreDestroy public synchronized void close() {
        closed = true;
        for (String profile : java.util.List.copyOf(entries.keySet())) invalidate(profile);
        // In-flight leases close their retired clients on release.
    }
}
