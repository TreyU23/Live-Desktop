package com.localassistant.os.service;

import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;
import com.localassistant.os.profile.ProfileContext;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import net.fortuna.ical4j.data.CalendarBuilder;
import net.fortuna.ical4j.model.Period;
import net.fortuna.ical4j.model.Property;
import net.fortuna.ical4j.model.component.VEvent;
import net.fortuna.ical4j.model.property.Location;
import net.fortuna.ical4j.model.property.Summary;
import net.fortuna.ical4j.model.property.Uid;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

@Service
public class ICloudCalendarService {
    private static final URI ICLOUD_CALDAV = URI.create("https://caldav.icloud.com/");
    private static final Duration CACHE_TTL = Duration.ofMinutes(4);
    private static final DateTimeFormatter CALDAV_UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
            .withZone(ZoneId.of("UTC"));
    private final ICloudCredentialStore credentials;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private final Map<String, ProfileCalendar> cache = new java.util.LinkedHashMap<>(16, .75f, true);
    private final java.util.concurrent.Semaphore fetchSlots = new java.util.concurrent.Semaphore(4, true);
    private final ThreadLocal<Long> fetchDeadline = new ThreadLocal<>();
    static final class ProfileCalendar {
        boolean valid = true;
        final Map<LocalDate, CalendarSnapshot> dates = new java.util.LinkedHashMap<>(8, .75f, true);
        final Map<LocalDate, java.util.concurrent.CompletableFuture<CalendarSnapshot>> pending = new HashMap<>();
        volatile List<CalendarCollection> discovery;
        volatile Instant discoveredAt;
    }

    public ICloudCalendarService(ICloudCredentialStore credentials) { this.credentials = credentials; }

    public CalendarSnapshot snapshot(LocalDate date, boolean forceRefresh) {
        String profile = ProfileContext.currentId();
        ICloudCredentialStore.Credentials account;
        ProfileCalendar state;
        CalendarSnapshot previous;
        java.util.concurrent.CompletableFuture<CalendarSnapshot> future;
        boolean owner;
        synchronized (cache) {
            var saved = credentials.load();
            if (saved.isEmpty()) return CalendarSnapshot.disconnected(date);
            account = saved.get();
            state = cache.computeIfAbsent(profile, ignored -> new ProfileCalendar());
            // Evict only idle entries. In-flight keys remain deduplicated.
            if (cache.size() > 32) {
                var iterator = cache.entrySet().iterator();
                while (cache.size() > 32 && iterator.hasNext()) {
                    var entry = iterator.next();
                    if (!entry.getKey().equals(profile) && entry.getValue().pending.isEmpty()) {
                        entry.getValue().valid = false; iterator.remove();
                    }
                }
            }
            if (cache.size() > 32) {
                cache.remove(profile); state.valid = false;
                return new CalendarSnapshot(true, account.email(), "error", "Calendar refresh is busy. Try again shortly.", date, List.of(), Instant.now());
            }
            previous = state.dates.get(date);
            if (!forceRefresh && previous != null && previous.capturedAt().isAfter(Instant.now().minus("error".equals(previous.status()) ? Duration.ofSeconds(15) : CACHE_TTL))) return previous;
            future = state.pending.get(date);
            owner = future == null;
            if (owner && state.pending.size() >= 8) return new CalendarSnapshot(true, account.email(), "error", "Calendar refresh is busy. Try again shortly.", date, List.of(), Instant.now());
            if (owner) { future = new java.util.concurrent.CompletableFuture<>(); state.pending.put(date, future); }
        }
        if (!owner) return future.join();
        CalendarSnapshot result;
        boolean permit = false;
        fetchDeadline.set(System.nanoTime() + Duration.ofSeconds(15).toNanos());
        try {
            permit = fetchSlots.tryAcquire(100, java.util.concurrent.TimeUnit.MILLISECONDS);
            if (!permit) throw new IllegalStateException("Calendar refresh is busy. Try again shortly.");
            result = fetch(account, date, state);
        } catch (Exception error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            result = new CalendarSnapshot(true, account.email(), "error", friendlyError(error), date,
                    previous == null ? List.of() : previous.events(), Instant.now());
        } finally { if (permit) fetchSlots.release(); fetchDeadline.remove(); }
        synchronized (cache) {
            if (!state.valid || cache.get(profile) != state) result = CalendarSnapshot.disconnected(date);
            else {
                state.dates.put(date, result);
                while (state.dates.size() > 8) state.dates.remove(state.dates.keySet().iterator().next());
            }
            state.pending.remove(date);
            future.complete(result);
        }
        return result;
    }

    public CalendarSnapshot connect(String email, String appSpecificPassword) throws Exception {
        if (email == null || email.isBlank() || !email.contains("@")) throw new IllegalArgumentException("Enter the email address for your Apple Account.");
        if (appSpecificPassword == null || appSpecificPassword.replace("-", "").length() < 16) throw new IllegalArgumentException("Enter a valid Apple app-specific password.");
        ProfileCalendar token;
        synchronized (cache) {
            invalidate();
            credentials.save(email.trim(), appSpecificPassword.trim());
            token = new ProfileCalendar(); cache.put(ProfileContext.currentId(), token);
        }
        CalendarSnapshot result = snapshot(LocalDate.now(), true);
        if (!"connected".equals(result.status())) {
            synchronized (cache) {
                if (cache.get(ProfileContext.currentId()) == token) { credentials.clear(); invalidate(); }
            }
            throw new IllegalArgumentException(result.detail());
        }
        return result;
    }

    public CalendarSnapshot disconnect() throws Exception {
        synchronized (cache) { invalidate(); credentials.clear(); }
        return CalendarSnapshot.disconnected(LocalDate.now());
    }

    private void invalidate() {
        var old = cache.remove(ProfileContext.currentId());
        if (old != null) old.valid = false;
    }

    public void clearCurrentCache() {
        synchronized (cache) { invalidate(); credentials.clearCurrentCache(); }
    }

    CalendarSnapshot fetch(ICloudCredentialStore.Credentials account, LocalDate date, ProfileCalendar state) throws Exception {
        String auth = "Basic " + Base64.getEncoder().encodeToString(
                (account.email() + ":" + account.appSpecificPassword()).getBytes(StandardCharsets.UTF_8));
        List<CalendarCollection> calendars = state.discovery;
        if (calendars == null || state.discoveredAt == null || state.discoveredAt.isBefore(Instant.now().minus(Duration.ofMinutes(30)))) {
            synchronized (state) {
                calendars = state.discovery;
                if (calendars == null || state.discoveredAt == null || state.discoveredAt.isBefore(Instant.now().minus(Duration.ofMinutes(30)))) {
        URI principal = resolve(ICLOUD_CALDAV, firstHref(send(ICLOUD_CALDAV, "PROPFIND", "0", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:current-user-principal/></d:prop></d:propfind>"),
                "current-user-principal"));
        URI home = resolve(principal, firstHref(send(principal, "PROPFIND", "0", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\"><d:prop><c:calendar-home-set/></d:prop></d:propfind>"),
                "calendar-home-set"));
            calendars = calendarCollections(home, send(home, "PROPFIND", "1", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>"));

                    state.discovery = List.copyOf(calendars); state.discoveredAt = Instant.now();
                }
            }
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant rangeStart = date.atStartOfDay(zone).toInstant();
        Instant rangeEnd = date.plusDays(1).atStartOfDay(zone).toInstant();
        String report = "<?xml version=\"1.0\"?><c:calendar-query xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\">"
                + "<d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name=\"VCALENDAR\">"
                + "<c:comp-filter name=\"VEVENT\"><c:time-range start=\"" + CALDAV_UTC.format(rangeStart)
                + "\" end=\"" + CALDAV_UTC.format(rangeEnd) + "\"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>";
        List<CalendarEvent> events = new ArrayList<>();
        for (CalendarCollection calendar : calendars) {
            String xml = send(calendar.uri(), "REPORT", "1", auth, report);
            for (String data : texts(xml, "calendar-data")) {
                events.addAll(parseEvents(data, calendar.name(), date, zone));
            }
        }
        events.sort(Comparator.comparing(CalendarEvent::start));
        return new CalendarSnapshot(true, account.email(), "connected",
                "Synced " + calendars.size() + " iCloud calendar" + (calendars.size() == 1 ? "" : "s"),
                date, events.stream().limit(100).toList(), Instant.now());
    }

    List<CalendarEvent> parseEvents(String ics, String calendarName, LocalDate date, ZoneId zone) {
        List<CalendarEvent> result = new ArrayList<>();
        try {
            var calendar = new CalendarBuilder().build(new StringReader(ics));
            for (VEvent event : calendar.getComponentList().<VEvent>getComponents("VEVENT")) {
                Optional<? extends net.fortuna.ical4j.model.property.DtStart<?>> startProperty = event.getStartDate();
                if (startProperty.isEmpty()) continue;
                Temporal eventStart = startProperty.get().getDate();
                Period<?> range = periodFor(eventStart, date, zone);
                @SuppressWarnings({"rawtypes", "unchecked"})
                List<Period<?>> occurrences = (List) event.getConsumedTime((Period) range);
                String title = event.getPropertyList().<Summary>getProperty(Property.SUMMARY)
                        .map(Summary::getValue).orElse("Untitled event");
                String location = event.getPropertyList().<Location>getProperty(Property.LOCATION)
                        .map(Location::getValue).orElse("");
                String uid = event.getPropertyList().<Uid>getProperty(Property.UID)
                        .map(Uid::getValue).orElse(Integer.toHexString(ics.hashCode()));
                for (Period<?> occurrence : occurrences) {
                    ZonedDateTime start = toZoned(occurrence.getStart(), zone);
                    ZonedDateTime end = toZoned(occurrence.getEnd(), zone);
                    result.add(new CalendarEvent(uid + "@" + start.toInstant(), title, start.toInstant(),
                            end.toInstant(), eventStart instanceof LocalDate, location, calendarName));
                }
            }
        } catch (Exception ignored) {
            // A malformed item should not prevent the rest of the calendar from syncing.
        }
        return result;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Period<?> periodFor(Temporal sample, LocalDate date, ZoneId fallback) {
        if (sample instanceof LocalDate) return new Period(date, date.plusDays(1));
        if (sample instanceof LocalDateTime) return new Period(date.atStartOfDay(), date.plusDays(1).atStartOfDay());
        if (sample instanceof ZonedDateTime zoned) return new Period(date.atStartOfDay(zoned.getZone()), date.plusDays(1).atStartOfDay(zoned.getZone()));
        if (sample instanceof OffsetDateTime offset) return new Period(date.atStartOfDay().atOffset(offset.getOffset()), date.plusDays(1).atStartOfDay().atOffset(offset.getOffset()));
        return new Period(date.atStartOfDay(fallback).toInstant(), date.plusDays(1).atStartOfDay(fallback).toInstant());
    }

    private ZonedDateTime toZoned(Temporal value, ZoneId fallback) {
        if (value instanceof ZonedDateTime zoned) return zoned;
        if (value instanceof OffsetDateTime offset) return offset.toZonedDateTime();
        if (value instanceof Instant instant) return instant.atZone(fallback);
        if (value instanceof LocalDateTime local) return local.atZone(fallback);
        if (value instanceof LocalDate date) return date.atStartOfDay(fallback);
        return ZonedDateTime.from(value);
    }

    static void validateCalendarUri(URI uri) {
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                || !(host.equalsIgnoreCase("icloud.com") || host.toLowerCase(Locale.ROOT).endsWith(".icloud.com"))
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
            throw new IllegalArgumentException("iCloud returned an untrusted calendar URL.");
        }
    }

    private String send(URI uri, String method, String depth, String authorization, String body) throws Exception {
        URI current = uri;
        for (int redirect = 0; redirect < 6; redirect++) {
            validateCalendarUri(current);
            HttpRequest request = HttpRequest.newBuilder(current)
                    .timeout(remainingBudget())
                    .header("Authorization", authorization)
                    .header("Depth", depth)
                    .header("Content-Type", "application/xml; charset=utf-8")
                    .header("User-Agent", "Live Desktop/1.0")
                    .method(method, HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 300 && response.statusCode() < 400) {
                String location = response.headers().firstValue("location").orElseThrow();
                current = current.resolve(location);
                continue;
            }
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                throw new IllegalArgumentException("Apple rejected the sign-in. Use an app-specific password, not your regular Apple Account password.");
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("iCloud Calendar returned HTTP " + response.statusCode() + ".");
            }
            return response.body();
        }
        throw new IllegalStateException("iCloud Calendar redirected too many times.");
    }

    private Duration remainingBudget() throws java.util.concurrent.TimeoutException {
        Long deadline = fetchDeadline.get();
        long remaining = deadline == null ? Duration.ofSeconds(30).toNanos() : deadline - System.nanoTime();
        if (remaining <= 0) throw new java.util.concurrent.TimeoutException("Calendar refresh timed out.");
        return Duration.ofNanos(remaining);
    }

    @jakarta.annotation.PreDestroy
    public void close() { http.close(); }

    private String firstHref(String xml, String parentLocalName) throws Exception {
        var document = parseXml(xml);
        NodeList parents = document.getElementsByTagNameNS("*", parentLocalName);
        if (parents.getLength() == 0) throw new IllegalStateException("iCloud did not return " + parentLocalName + ".");
        NodeList hrefs = ((Element) parents.item(0)).getElementsByTagNameNS("*", "href");
        if (hrefs.getLength() == 0) throw new IllegalStateException("iCloud did not return a calendar URL.");
        return hrefs.item(0).getTextContent().trim();
    }

    private List<CalendarCollection> calendarCollections(URI home, String xml) throws Exception {
        var document = parseXml(xml);
        List<CalendarCollection> results = new ArrayList<>();
        NodeList responses = document.getElementsByTagNameNS("*", "response");
        for (int index = 0; index < responses.getLength(); index++) {
            Element response = (Element) responses.item(index);
            if (response.getElementsByTagNameNS("*", "calendar").getLength() == 0) continue;
            NodeList components = response.getElementsByTagNameNS("*", "comp");
            boolean supportsEvents = components.getLength() == 0;
            for (int componentIndex = 0; componentIndex < components.getLength(); componentIndex++) {
                if ("VEVENT".equalsIgnoreCase(((Element) components.item(componentIndex)).getAttribute("name"))) {
                    supportsEvents = true;
                    break;
                }
            }
            if (!supportsEvents) continue;
            NodeList hrefs = response.getElementsByTagNameNS("*", "href");
            if (hrefs.getLength() == 0) continue;
            NodeList names = response.getElementsByTagNameNS("*", "displayname");
            String name = names.getLength() > 0 && !names.item(0).getTextContent().isBlank()
                    ? names.item(0).getTextContent().trim() : "iCloud";
            results.add(new CalendarCollection(name, resolve(home, hrefs.item(0).getTextContent().trim())));
        }
        return results;
    }

    private List<String> texts(String xml, String localName) throws Exception {
        NodeList nodes = parseXml(xml).getElementsByTagNameNS("*", localName);
        List<String> values = new ArrayList<>();
        for (int index = 0; index < nodes.getLength(); index++) values.add(nodes.item(index).getTextContent());
        return values;
    }

    private org.w3c.dom.Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        return factory.newDocumentBuilder().parse(new org.xml.sax.InputSource(new StringReader(xml)));
    }

    private URI resolve(URI base, String href) {
        return href.toLowerCase(Locale.ROOT).startsWith("http") ? URI.create(href) : base.resolve(href);
    }

    private String friendlyError(Exception error) {
        String message = error.getMessage();
        return message == null || message.isBlank() ? "iCloud Calendar could not be refreshed." : message;
    }

    private record CalendarCollection(String name, URI uri) {}

    public record CalendarEvent(String id, String title, Instant start, Instant end, boolean allDay,
                                String location, String calendar) {}

    public record CalendarSnapshot(boolean connected, String email, String status, String detail,
                                   LocalDate date, List<CalendarEvent> events, Instant capturedAt) {
        static CalendarSnapshot disconnected(LocalDate date) {
            return new CalendarSnapshot(false, "", "disconnected", "Connect iCloud Calendar in Settings.",
                    date, List.of(), Instant.now());
        }
    }
}
