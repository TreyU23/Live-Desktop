package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class ICloudCalendarServiceTest {
    @Test void rejectsCredentialForwardingOutsideAppleTlsHosts() {
        for (String value : java.util.List.of("http://caldav.icloud.com/", "https://icloud.com.attacker.invalid/", "https://attacker.invalid/", "https://user@caldav.icloud.com/", "https://caldav.icloud.com:444/")) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> ICloudCalendarService.validateCalendarUri(java.net.URI.create(value))).isInstanceOf(IllegalArgumentException.class);
        }
        ICloudCalendarService.validateCalendarUri(java.net.URI.create("https://p123-caldav.icloud.com/123/calendars/"));
    }

    @Test void allDayEventsRemainOnTheSelectedDayAtDaylightSavingBoundary() {
        String calendar = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\nBEGIN:VEVENT\r\nUID:all-day\r\nDTSTART;VALUE=DATE:20260308\r\nDTEND;VALUE=DATE:20260309\r\nSUMMARY:All day\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        var service = new ICloudCalendarService(null);
        var events = service.parseEvents(calendar, "Home", LocalDate.of(2026, 3, 8), ZoneId.of("America/Chicago"));
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().allDay()).isTrue();
        assertThat(java.time.Duration.between(events.getFirst().start(), events.getFirst().end()).toHours()).isEqualTo(23);
        assertThat(service.parseEvents(calendar, "Home", LocalDate.of(2026, 3, 9), ZoneId.of("America/Chicago"))).isEmpty();
    }
    @Test
    void parsesRecurringICloudEventsForTheSelectedDay() {
        String calendar = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Live Desktop Test//EN
                BEGIN:VEVENT
                UID:daily-sync
                DTSTART:20260802T150000Z
                DTEND:20260802T153000Z
                RRULE:FREQ=DAILY;COUNT=2
                SUMMARY:Daily sync
                LOCATION:Teams
                END:VEVENT
                END:VCALENDAR
                """.replace("\n", "\r\n");

        var service = new ICloudCalendarService(null);
        var events = service.parseEvents(calendar, "Work", LocalDate.of(2026, 8, 3), ZoneId.of("UTC"));

        assertThat(events).hasSize(1);
        assertThat(events.getFirst().title()).isEqualTo("Daily sync");
        assertThat(events.getFirst().location()).isEqualTo("Teams");
        assertThat(events.getFirst().calendar()).isEqualTo("Work");
    }
}
