package com.localassistant.os.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.util.LinkedHashMap;

/** Bounded cache of stable JSON reads; partial replacements are never cached. */
final class PhoneMetadataCache {
    private final ObjectMapper mapper = new ObjectMapper();
    private final LinkedHashMap<Path, Entry> cache = new LinkedHashMap<>();
    synchronized JsonNode read(Path path, boolean refresh) {
        try {
            var before = Files.readAttributes(path, BasicFileAttributes.class);
            if (!before.isRegularFile() || before.size() > 1024 * 1024) return mapper.createObjectNode();
            var previous = cache.get(path);
            if (!refresh && previous != null && previous.size == before.size()
                    && previous.modified.equals(before.lastModifiedTime())
                    && System.nanoTime() - previous.at < Duration.ofSeconds(30).toNanos()) return previous.value;
            byte[] bytes;
            try (var input = Files.newInputStream(path)) { bytes = input.readNBytes(1024 * 1024 + 1); }
            if (bytes.length > 1024 * 1024) return mapper.createObjectNode();
            var parsed = mapper.readTree(bytes);
            var after = Files.readAttributes(path, BasicFileAttributes.class);
            if (parsed == null || before.size() != after.size() || !before.lastModifiedTime().equals(after.lastModifiedTime())) return mapper.createObjectNode();
            cache.put(path, new Entry(before.size(), before.lastModifiedTime(), System.nanoTime(), parsed));
            while (cache.size() > 2) cache.remove(cache.keySet().iterator().next());
            return parsed;
        } catch (Exception ignored) { cache.remove(path); return mapper.createObjectNode(); }
    }
    private record Entry(long size, java.nio.file.attribute.FileTime modified, long at, JsonNode value) {}
}
