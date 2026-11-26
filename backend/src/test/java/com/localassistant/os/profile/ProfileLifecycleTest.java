package com.localassistant.os.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Issue #6: a DELETE during a chat must not freeze the profile until the reply finishes. */
class ProfileLifecycleTest {
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @AfterEach
    void shutdown() {
        executor.shutdownNow();
    }

    @Test
    void suspendedChatDoesNotBlockDeletionOrLaterReaders() throws Exception {
        CountDownLatch inCall = new CountDownLatch(1);
        CountDownLatch finishCall = new CountDownLatch(1);
        Future<String> chat = executor.submit(() -> {
            try (var lease = ProfileLifecycle.acquire("p6")) {
                try (var suspended = ProfileLifecycle.suspend()) {
                    inCall.countDown();
                    finishCall.await();
                }
                return "saved";
            } catch (ProfileLifecycle.ProfileDeletedException deleted) {
                return "deleted";
            }
        });
        assertThat(inCall.await(1, TimeUnit.SECONDS)).isTrue();

        executor.submit(() -> {
            try (var lease = ProfileLifecycle.acquire("p6")) {
                ProfileLifecycle.exclusive("p6", () -> {});
            }
            return null;
        }).get(1, TimeUnit.SECONDS);
        executor.submit(() -> {
            try (var lease = ProfileLifecycle.acquire("p6")) {
                return null;
            }
        }).get(1, TimeUnit.SECONDS);

        finishCall.countDown();
        assertThat(chat.get(1, TimeUnit.SECONDS)).isEqualTo("deleted");
    }

    @Test
    void deletionStillWaitsForActiveStateWork() throws Exception {
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        executor.submit(() -> {
            try (var lease = ProfileLifecycle.acquire("q6")) {
                holding.countDown();
                release.await();
            }
            return null;
        });
        assertThat(holding.await(1, TimeUnit.SECONDS)).isTrue();
        Future<?> deletion = executor.submit(() -> {
            ProfileLifecycle.exclusive("q6", () -> {});
            return null;
        });
        assertThatThrownBy(() -> deletion.get(300, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
        release.countDown();
        deletion.get(1, TimeUnit.SECONDS);
    }

    @Test
    void deletionStaysVisibleToLaterResumesAfterTheFirstIsLost() throws Exception {
        // Issue #27: a caller that lost the first ProfileDeletedException (suppressed on a retried I/O error)
        // must still see the deletion on its next resume.
        try (var lease = ProfileLifecycle.acquire("s27")) {
            var first = ProfileLifecycle.suspend();
            executor.submit(() -> {
                ProfileLifecycle.exclusive("s27", () -> {});
                return null;
            }).get(1, TimeUnit.SECONDS);
            assertThatThrownBy(first::close).isInstanceOf(ProfileLifecycle.ProfileDeletedException.class);
            var second = ProfileLifecycle.suspend();
            assertThatThrownBy(second::close).isInstanceOf(ProfileLifecycle.ProfileDeletedException.class);
        }
    }

    @Test
    void ownDeletionDoesNotFailTheDeletingRequest() throws Exception {
        try (var lease = ProfileLifecycle.acquire("t27")) {
            ProfileLifecycle.exclusive("t27", () -> {});
            ProfileLifecycle.suspend().close();
        }
    }

    @Test
    void ordinaryRequestsShareTheLease() throws Exception {
        try (var first = ProfileLifecycle.acquire("r6")) {
            executor.submit(() -> {
                try (var second = ProfileLifecycle.acquire("r6")) {
                    return null;
                }
            }).get(1, TimeUnit.SECONDS);
        }
    }
}
