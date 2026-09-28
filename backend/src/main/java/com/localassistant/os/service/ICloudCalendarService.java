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
    private final Map<String, CalendarSnapshot> cache = new HashMap<>();

    public ICloudCalendarService(ICloudCredentialStore credentials) {
        this.credentials = credentials;
    }

    public synchronized CalendarSnapshot snapshot(LocalDate date, boolean forceRefresh) {
        Optional<ICloudCredentialStore.Credentials> saved = credentials.load();
        if (saved.isEmpty()) return CalendarSnapshot.disconnected(date);
        CalendarSnapshot cached = cache.get(ProfileContext.currentId());
        if (!forceRefresh && cached != null && cached.date().equals(date)
                && cached.capturedAt().isAfter(Instant.now().minus(CACHE_TTL))) {
            return cached;
        }
        try {
            cached = fetch(saved.get(), date);
        } catch (Exception error) {
            List<CalendarEvent> previous = cached != null && cached.date().equals(date) ? cached.events() : List.of();
            cached = new CalendarSnapshot(true, saved.get().email(), "error", friendlyError(error),
                    date, previous, Instant.now());
        }
        cache.put(ProfileContext.currentId(), cached);
        return cached;
    }

    public synchronized CalendarSnapshot connect(String email, String appSpecificPassword) throws Exception {
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new IllegalArgumentException("Enter the email address for your Apple Account.");
        }
        if (appSpecificPassword == null || appSpecificPassword.replace("-", "").length() < 16) {
            throw new IllegalArgumentException("Enter a valid Apple app-specific password.");
        }
        credentials.save(email.trim(), appSpecificPassword.trim());
        cache.remove(ProfileContext.currentId());
        CalendarSnapshot result = snapshot(LocalDate.now(), true);
        if (!"connected".equals(result.status())) {
            credentials.clear();
            cache.remove(ProfileContext.currentId());
            throw new IllegalArgumentException(result.detail());
        }
        return result;
    }

    public synchronized CalendarSnapshot disconnect() throws Exception {
        credentials.clear();
        cache.remove(ProfileContext.currentId());
        return CalendarSnapshot.disconnected(LocalDate.now());
    }

    public synchronized void clearCurrentCache() {
        cache.remove(ProfileContext.currentId());
        credentials.clearCurrentCache();
    }

    private CalendarSnapshot fetch(ICloudCredentialStore.Credentials account, LocalDate date) throws Exception {
        String auth = "Basic " + Base64.getEncoder().encodeToString(
                (account.email() + ":" + account.appSpecificPassword()).getBytes(StandardCharsets.UTF_8));
        URI principal = resolve(ICLOUD_CALDAV, firstHref(send(ICLOUD_CALDAV, "PROPFIND", "0", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:current-user-principal/></d:prop></d:propfind>"),
                "current-user-principal"));
        URI home = resolve(principal, firstHref(send(principal, "PROPFIND", "0", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\"><d:prop><c:calendar-home-set/></d:prop></d:propfind>"),
                "calendar-home-set"));
        List<CalendarCollection> calendars = calendarCollections(home, send(home, "PROPFIND", "1", auth,
                "<?xml version=\"1.0\"?><d:propfind xmlns:d=\"DAV:\" xmlns:c=\"urn:ietf:params:xml:ns:caldav\"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>"));

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

    private String send(URI uri, String method, String depth, String authorization, String body) throws Exception {
        URI current = uri;
        for (int redirect = 0; redirect < 6; redirect++) {
            HttpRequest request = HttpRequest.newBuilder(current)
                    .timeout(Duration.ofSeconds(30))
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
