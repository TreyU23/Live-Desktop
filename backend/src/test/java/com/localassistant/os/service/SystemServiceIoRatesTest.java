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
}
