package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class SystemServiceIoRatesTest {
    @Test
    void computesBytesPerSecondFromCumulativeCounters() {
        Instant start = Instant.parse("2026-11-05T12:00:00Z");
        var previous = new SystemService.IoCounterSample(start, 1_000, 2_000, 10_000, 20_000, true);
        var current = new SystemService.IoCounterSample(start.plusSeconds(10), 11_000, 7_000, 30_000, 40_000, true);

        var rates = SystemService.computeIoRates(previous, current);

        assertThat(rates.networkAvailable()).isTrue();
        assertThat(rates.rxBytesPerSec()).isEqualTo(1_000L);
        assertThat(rates.txBytesPerSec()).isEqualTo(500L);
        assertThat(rates.diskActivity().available()).isTrue();
        assertThat(rates.diskActivity().readBytesPerSec()).isEqualTo(2_000L);
        assertThat(rates.diskActivity().writeBytesPerSec()).isEqualTo(2_000L);
    }

    @Test
    void treatsFirstSampleAndCounterResetsAsUnavailable() {
        Instant start = Instant.parse("2026-11-05T12:00:00Z");
        var previous = new SystemService.IoCounterSample(start, 5_000, 5_000, 5_000, 5_000, true);
        var reset = new SystemService.IoCounterSample(start.plusSeconds(10), 100, 100, 100, 100, true);
        var tooFast = new SystemService.IoCounterSample(start.plusMillis(200), 6_000, 6_000, 6_000, 6_000, true);
        var tooSlow = new SystemService.IoCounterSample(start.plusSeconds(400), 6_000, 6_000, 6_000, 6_000, true);

        assertThat(SystemService.computeIoRates(previous, reset).networkAvailable()).isFalse();
        assertThat(SystemService.computeIoRates(previous, tooFast).networkAvailable()).isFalse();
        assertThat(SystemService.computeIoRates(previous, tooSlow).networkAvailable()).isFalse();
    }

    @Test
    void keepsDiskUnavailableWhenBridgeReportsDiskUnavailable() {
        Instant start = Instant.parse("2026-11-05T12:00:00Z");
        var previous = new SystemService.IoCounterSample(start, 1_000, 2_000, 0, 0, false);
        var current = new SystemService.IoCounterSample(start.plusSeconds(10), 2_000, 4_000, 0, 0, false);

        var rates = SystemService.computeIoRates(previous, current);

        assertThat(rates.networkAvailable()).isTrue();
        assertThat(rates.rxBytesPerSec()).isEqualTo(100L);
        assertThat(rates.diskActivity().available()).isFalse();
        assertThat(rates.diskActivity().readBytesPerSec()).isNull();
    }

    @Test
    void twoPollersHalfASecondApartBothGetRates() {
        Instant start = Instant.parse("2026-11-05T12:00:00Z");
        var tracker = new SystemService.IoRateTracker();

        // Window A polls on the even seconds, window B half a second later; counters grow 1,000 bytes/s.
        assertThat(tracker.next(sample(start, 0)).networkAvailable()).isFalse(); // first sample ever
        assertThat(tracker.next(sample(start, 500)).networkAvailable()).isFalse(); // nothing computed yet
        for (int second = 2; second <= 10; second += 2) {
            var a = tracker.next(sample(start, second * 1_000L));
            var b = tracker.next(sample(start, second * 1_000L + 500));
            assertThat(a.networkAvailable()).as("window A at %ss", second).isTrue();
            assertThat(a.rxBytesPerSec()).isEqualTo(1_000L);
            assertThat(b.networkAvailable()).as("window B at %ss", second).isTrue();
            assertThat(b.rxBytesPerSec()).isEqualTo(1_000L);
        }
    }

    @Test
    void sharedRatesExpireAndOldBaselinesAreReplaced() {
        Instant start = Instant.parse("2026-11-05T12:00:00Z");
        var tracker = new SystemService.IoRateTracker();
        tracker.next(sample(start, 0));
        assertThat(tracker.next(sample(start, 2_000)).networkAvailable()).isTrue();

        // A burst of fast callers keeps getting the last result while it is fresh...
        assertThat(tracker.next(sample(start, 2_400)).networkAvailable()).isTrue();
        // ...and a gap longer than IO_RATE_MAX_ELAPSED resets the baseline instead of averaging over it.
        long later = 2_000 + SystemService.IO_RATE_SHARE_FOR.toMillis() + 400_000;
        assertThat(tracker.next(sample(start, later)).networkAvailable()).isFalse();
        assertThat(tracker.next(sample(start, later + 300)).networkAvailable()).isFalse();
        assertThat(tracker.next(sample(start, later + 2_000)).networkAvailable()).isTrue();
    }

    /** Counters grow at 1,000 bytes per second in every direction. */
    private static SystemService.IoCounterSample sample(Instant start, long millis) {
        long bytes = 10_000 + millis;
        return new SystemService.IoCounterSample(start.plusMillis(millis), bytes, bytes, bytes, bytes, true);
    }
}
