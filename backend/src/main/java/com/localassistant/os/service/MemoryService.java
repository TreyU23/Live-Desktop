package com.localassistant.os.service;

import com.localassistant.os.model.Memory;
import com.localassistant.os.store.StateStore;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class MemoryService {
    private static final Set<String> CATEGORIES = Set.of("preference", "project", "fact", "instruction");
    private final StateStore store;

    public MemoryService(StateStore store) {
        this.store = store;
    }

    public List<Memory> list() {
        return store.memories();
    }

    public List<Memory> search(String query, int requestedLimit) {
        List<String> terms = query == null
                ? List.of()
                : List.of(query.toLowerCase().trim().split("\\s+"));
        int limit = Math.max(1, Math.min(requestedLimit, 25));
        return list().stream()
                .map(memory -> new ScoredMemory(memory, score(memory, terms)))
                .filter(scored -> terms.isEmpty() || scored.score() > 0)
                .sorted(Comparator.comparingInt(ScoredMemory::score).reversed()
                        .thenComparing(scored -> scored.memory().updatedAt(), Comparator.reverseOrder()))
                .limit(limit)
                .map(ScoredMemory::memory)
                .toList();
    }

    public Memory add(String content, String category) throws IOException {
        String cleaned = content == null ? "" : content.trim();
        if (cleaned.isEmpty() || cleaned.length() > 2_000) {
            throw new IllegalArgumentException("Memory content must contain 1 to 2,000 characters.");
        }
        if (!CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("Invalid memory category.");
        }
        return store.addMemory(cleaned, category);
    }

    public boolean delete(String id) throws IOException {
        return store.deleteMemory(id);
    }

    private int score(Memory memory, List<String> terms) {
        String searchable = (memory.category() + " " + memory.content()).toLowerCase();
        return (int) terms.stream().filter(term -> term.length() > 1 && searchable.contains(term)).count();
    }

    private record ScoredMemory(Memory memory, int score) {}
}
