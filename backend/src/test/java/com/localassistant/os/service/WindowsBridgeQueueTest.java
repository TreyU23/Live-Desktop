package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

/** Issue #10: calls that time out waiting in the queue must not kill a healthy bridge. */
class WindowsBridgeQueueTest {

    /** Simulated bridge: every call takes {@code callMillis}; counts restarts. */
    private static final class FakeBridge extends WindowsBridgeClient {
        final AtomicInteger resets = new AtomicInteger();
        final long callMillis;

        FakeBridge(Duration queueTimeout, Duration callTimeout, long callMillis) {
            super(Path.of("unused.exe"), queueTimeout, callTimeout);
            this.callMillis = callMillis;
        }

        @Override boolean supported() { return true; }

        @Override Map<String, Object> exchange(String operation, Map<String, Object> arguments) throws Exception {
            Thread.sleep(callMillis);
            return Map.of("available", true, "operation", operation);
        }

        @Override void reset() { resets.incrementAndGet(); }
    }

    @Test void queuedCallsThatExpireReturnBusyWithoutResettingTheBridge() throws Exception {
        ExecutorService callers = Executors.newFixedThreadPool(6);
        try (var bridge = new FakeBridge(Duration.ofMillis(150), Duration.ofSeconds(5), 400)) {
            List<Future<Map<String, Object>>> results = new ArrayList<>();
            for (int i = 0; i < 6; i++) results.add(callers.submit(() -> bridge.request("battery.snapshot", Map.of())));
            int ok = 0, busy = 0;
            for (var result : results) {
                var value = result.get(10, TimeUnit.SECONDS);
                if (Boolean.TRUE.equals(value.get("available"))) ok++;
                else if ("BRIDGE_BUSY".equals(value.get("code"))) busy++;
            }
            assertThat(ok).isGreaterThanOrEqualTo(1);
            assertThat(busy).isGreaterThanOrEqualTo(1);
            assertThat(ok + busy).isEqualTo(6);
            assertThat(bridge.resets.get()).isZero();
        } finally {
            callers.shutdownNow();
        }
    }

    @Test void eachDispatchedCallGetsItsFullDeadlineAfterWaiting() throws Exception {
        // Each call takes 300ms of a 500ms budget; the last waits ~900ms in the queue first.
        // A shared deadline would have expired it and reset the bridge.
        ExecutorService callers = Executors.newFixedThreadPool(4);
        try (var bridge = new FakeBridge(Duration.ofSeconds(5), Duration.ofMillis(500), 300)) {
            List<Future<Map<String, Object>>> results = new ArrayList<>();
            for (int i = 0; i < 4; i++) results.add(callers.submit(() -> bridge.request("media.snapshot", Map.of())));
            for (var result : results) assertThat(result.get(10, TimeUnit.SECONDS)).containsEntry("available", true);
            assertThat(bridge.resets.get()).isZero();
        } finally {
            callers.shutdownNow();
        }
    }

    @Test void aDispatchedCallThatHangsStillResetsTheBridge() {
        try (var bridge = new FakeBridge(Duration.ofSeconds(1), Duration.ofMillis(100), 2_000)) {
            assertThat(bridge.request("wmi.query", Map.of())).containsEntry("available", false);
            // close() also resets, so check before it runs.
            assertThat(bridge.resets.get()).isEqualTo(1);
        }
    }
}
