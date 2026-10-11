package com.localassistant.os.store;

import com.google.gson.Gson;
import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.model.*;
import com.localassistant.os.profile.ProfilePaths;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;

@EnabledIfSystemProperty(named = "live.desktop.benchmarks", matches = "true")
class StatePerformanceTest {
    @TempDir Path directory;
    @Test void compareHistorySizeAndAllocations() throws Exception {
        var results = new java.util.ArrayList<Map<String, Object>>();
        var allocations = (com.sun.management.ThreadMXBean) java.lang.management.ManagementFactory.getThreadMXBean();
        for (int bytes : new int[]{20 * 1024, 1024 * 1024, 10 * 1024 * 1024}) {
            var properties = new AssistantProperties(); properties.setDataDir(directory.toString());
            var message = new ConversationMessage("message", "user", "x".repeat(bytes), "now");
            var data = new AppState(1, List.of(new Conversation("conversation", "Synthetic", List.of(message), "now", "now")), List.of(new Memory("memory", "Synthetic", "fact", "now", "now")), List.of());
            Files.writeString(directory.resolve("assistant-state.json"), new Gson().toJson(data));
            var store = new StateStore(new ProfilePaths(properties)); store.memories();
            for (boolean targeted : new boolean[]{false,true}) {
                var times = new java.util.ArrayList<Double>();
                long before = allocations.getThreadAllocatedBytes(Thread.currentThread().threadId());
                for (int sample = 0; sample < 100; sample++) {
                    long start = System.nanoTime();
                    Object result = targeted ? store.memories() : store.snapshot().memories();
                    if (result == null) throw new AssertionError();
                    times.add((System.nanoTime() - start) / 1_000_000.0);
                }
                long allocated = allocations.getThreadAllocatedBytes(Thread.currentThread().threadId()) - before;
                times.sort(Double::compare);
                results.add(Map.of("historyBytes", bytes, "targeted", targeted, "samples", 100, "medianMs", times.get(50), "p95Ms", times.get(94), "allocatedBytesPerRead", allocated / 100));
            }
        }
        Path output = Path.of("target/performance"); Files.createDirectories(output);
        Files.writeString(output.resolve("state-reads.json"), new Gson().toJson(results));
    }
}
