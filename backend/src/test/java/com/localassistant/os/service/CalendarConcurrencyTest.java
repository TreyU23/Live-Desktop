package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.localassistant.os.profile.ProfileContext;
import java.time.LocalDate;
import java.util.Optional;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;

class CalendarConcurrencyTest {
    private static final String SLOW = "00000000_0000_4000_8000_000000000001";
    private static final String FAST = "00000000_0000_4000_8000_000000000002";

    @Test void deduplicatesReadsAndDisconnectDiscardsPendingResult() throws Exception {
        var credentials = mock(ICloudCredentialStore.class);
        var saved = new java.util.concurrent.atomic.AtomicReference<>(Optional.of(new ICloudCredentialStore.Credentials("synthetic@example.invalid", "synthetic-password")));
        var readers = new CountDownLatch(2);
        when(credentials.load()).thenAnswer(call -> { readers.countDown(); return saved.get(); });
        doAnswer(call -> { saved.set(Optional.empty()); return null; }).when(credentials).clear();
        var service = spy(new ICloudCalendarService(credentials));
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1);
        var date = LocalDate.of(2026, 10, 10);
        doAnswer(call -> { entered.countDown(); if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("test deadline"); return new ICloudCalendarService.CalendarSnapshot(true, "synthetic@example.invalid", "connected", "test", date, java.util.List.of(), java.time.Instant.now()); }).when(service).fetch(any(), any(), any());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.snapshot(date, true));
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
            var second = executor.submit(() -> service.snapshot(date, true));
            assertThat(readers.await(3, TimeUnit.SECONDS)).isTrue();
            service.disconnect(); release.countDown();
            assertThat(first.get(3, TimeUnit.SECONDS).connected()).isFalse();
            assertThat(second.get(3, TimeUnit.SECONDS).connected()).isFalse();
            verify(service, times(1)).fetch(any(), any(), any());
        } finally { release.countDown(); service.close(); ProfileContext.clear(); }
    }
    @Test void slowProfileDoesNotHoldServiceWideNetworkLock() throws Exception {
        var credentials = mock(ICloudCredentialStore.class);
        when(credentials.load()).thenReturn(Optional.of(new ICloudCredentialStore.Credentials("synthetic@example.invalid", "synthetic-password")));
        var service = spy(new ICloudCalendarService(credentials));
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1); var date = LocalDate.now();
        doAnswer(call -> {
            if (ProfileContext.currentId().equals(SLOW)) { entered.countDown(); if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("test deadline"); }
            return new ICloudCalendarService.CalendarSnapshot(true, "synthetic@example.invalid", "connected", "test", date, java.util.List.of(), java.time.Instant.now());
        }).when(service).fetch(any(), any(), any());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var slow = executor.submit(() -> { ProfileContext.set(SLOW); try { return service.snapshot(date, true); } finally { ProfileContext.clear(); } });
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
            var fast = executor.submit(() -> { ProfileContext.set(FAST); try { return service.snapshot(date, true); } finally { ProfileContext.clear(); } });
            assertThat(fast.get(1, TimeUnit.SECONDS).connected()).isTrue(); release.countDown(); slow.get(3, TimeUnit.SECONDS);
        } finally { release.countDown(); service.close(); }
    }

    @Test void ownerErrorReleasesWaitersAndThePendingSlot() throws Exception {
        var credentials = mock(ICloudCredentialStore.class);
        when(credentials.load()).thenReturn(Optional.of(new ICloudCredentialStore.Credentials("synthetic@example.invalid", "synthetic-password")));
        var service = spy(new ICloudCalendarService(credentials));
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1); var date = LocalDate.of(2026, 10, 11);
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(call -> {
            if (calls.incrementAndGet() == 1) {
                entered.countDown();
                if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("test deadline");
                throw new OutOfMemoryError("synthetic");
            }
            return new ICloudCalendarService.CalendarSnapshot(true, "synthetic@example.invalid", "connected", "test", date, java.util.List.of(), java.time.Instant.now());
        }).when(service).fetch(any(), any(), any());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var owner = executor.submit(() -> service.snapshot(date, true));
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
            var waiter = executor.submit(() -> service.snapshot(date, true));
            Thread.sleep(200); // let the waiter reach the shared future
            release.countDown();
            assertThatThrownBy(() -> owner.get(3, TimeUnit.SECONDS)).hasCauseInstanceOf(OutOfMemoryError.class);
            var waited = waiter.get(3, TimeUnit.SECONDS);
            assertThat(waited.status()).isEqualTo("error");
            // The failed refresh no longer occupies the date's pending slot, so the next request fetches again.
            assertThat(service.snapshot(date, true).status()).isEqualTo("connected");
            verify(service, times(2)).fetch(any(), any(), any());
        } finally { release.countDown(); service.close(); }
    }

    @Test void waitersGiveUpAfterTheWaiterTimeout() throws Exception {
        var credentials = mock(ICloudCredentialStore.class);
        when(credentials.load()).thenReturn(Optional.of(new ICloudCredentialStore.Credentials("synthetic@example.invalid", "synthetic-password")));
        var service = spy(new ICloudCalendarService(credentials));
        service.waiterTimeout = java.time.Duration.ofMillis(200);
        var entered = new CountDownLatch(1); var release = new CountDownLatch(1); var date = LocalDate.of(2026, 10, 12);
        doAnswer(call -> {
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("test deadline");
            return new ICloudCalendarService.CalendarSnapshot(true, "synthetic@example.invalid", "connected", "test", date, java.util.List.of(), java.time.Instant.now());
        }).when(service).fetch(any(), any(), any());
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var owner = executor.submit(() -> service.snapshot(date, true));
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
            var waited = executor.submit(() -> service.snapshot(date, true)).get(3, TimeUnit.SECONDS);
            assertThat(waited.status()).isEqualTo("error");
            assertThat(waited.detail()).contains("taking too long");
            release.countDown();
            assertThat(owner.get(3, TimeUnit.SECONDS).status()).isEqualTo("connected");
        } finally { release.countDown(); service.close(); }
    }
}
