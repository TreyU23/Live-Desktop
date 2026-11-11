package com.localassistant.os.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Enumeration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Stops other websites from calling the loopback API. Each backend launch creates a token and
 * returns it from {@code GET /health}. Every other route requires that token. {@code Host} must be
 * loopback on the accepting port, a present {@code Origin} must be the dashboard or this backend,
 * and {@code POST} and {@code DELETE} require {@code Content-Type: application/json}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LocalAccessFilter extends OncePerRequestFilter {
    public static final String TOKEN_HEADER = "X-Live-Desktop-Token";
    static final int DASHBOARD_PORT = 4173;

    private static final byte[] REJECTION =
            "{\"error\":\"Local access only\"}".getBytes(StandardCharsets.UTF_8);
    private static final Set<String> MUTATING = Set.of("POST", "DELETE");
    private static final Set<String> LOOPBACK_PEERS = Set.of(
            "127.0.0.1", "localhost", "::1", "0:0:0:0:0:0:0:1");

    private final String token = HexFormat.of().formatHex(randomToken());

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!allowedHost(request)) {
            reject(response);
            return;
        }
        String origin = singleHeader(request, "Origin");
        if (origin == null && duplicateHeader(request, "Origin")) {
            reject(response);
            return;
        }
        int localPort = request.getLocalPort();
        if (origin != null && !allowedOrigin(origin, localPort)) {
            reject(response);
            return;
        }
        if (origin != null) exposeDashboardOrigin(response, origin);
        if ("OPTIONS".equals(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            response.setContentLength(0);
            return;
        }
        if (MUTATING.contains(request.getMethod()) && !jsonContent(request)) {
            reject(response);
            return;
        }
        boolean health = "GET".equals(request.getMethod()) && "/health".equals(request.getRequestURI());
        if (!health && !authorized(singleHeader(request, TOKEN_HEADER))) {
            reject(response);
            return;
        }
        if (health) {
            if (isLoopbackPeer(request)) response.setHeader(TOKEN_HEADER, token);
            response.setHeader("Cache-Control", "no-store");
        }
        chain.doFilter(request, response);
    }

    static boolean isLoopbackPeer(HttpServletRequest request) {
        String address = request.getRemoteAddr();
        return address != null && LOOPBACK_PEERS.contains(address);
    }

    private boolean authorized(String provided) {
        if (provided == null || duplicateHeaderValue(provided) || provided.length() != token.length()) return false;
        return MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), provided.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean duplicateHeaderValue(String value) {
        return value.indexOf(',') >= 0;
    }

    private static boolean allowedHost(HttpServletRequest request) {
        String host = singleHeader(request, "Host");
        if (host == null || host.chars().anyMatch(character -> character <= ' ')) return false;
        int colon = host.lastIndexOf(':');
        if (colon <= 0 || host.indexOf(':') != colon) return false;
        String name = host.substring(0, colon);
        String port = host.substring(colon + 1);
        if (!port.equals(Integer.toString(request.getLocalPort()))) return false;
        return "127.0.0.1".equals(name) || "localhost".equals(name.toLowerCase(Locale.ROOT));
    }

    static boolean allowedOrigin(String origin, int localPort) {
        if (origin.isEmpty() || "null".equalsIgnoreCase(origin)) return false;
        for (int port : new int[] {DASHBOARD_PORT, localPort}) {
            if (origin.equals("http://127.0.0.1:" + port) || origin.equals("http://localhost:" + port)) return true;
        }
        return false;
    }

    private static boolean jsonContent(HttpServletRequest request) {
        Enumeration<String> headers = request.getHeaders("Content-Type");
        if (headers == null || !headers.hasMoreElements()) return false;
        String header = headers.nextElement();
        if (headers.hasMoreElements() || header.indexOf(',') >= 0) return false;
        try {
            MediaType mediaType = MediaType.parseMediaType(header);
            return "application".equalsIgnoreCase(mediaType.getType()) && "json".equals(mediaType.getSubtype());
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static String singleHeader(HttpServletRequest request, String name) {
        Enumeration<String> headers = request.getHeaders(name);
        if (headers == null || !headers.hasMoreElements()) return null;
        String value = headers.nextElement();
        if (headers.hasMoreElements()) return null;
        return value;
    }

    private static boolean duplicateHeader(HttpServletRequest request, String name) {
        Enumeration<String> headers = request.getHeaders(name);
        if (headers == null || !headers.hasMoreElements()) return false;
        headers.nextElement();
        return headers.hasMoreElements();
    }

    private static void exposeDashboardOrigin(HttpServletResponse response, String origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Profile-Id, " + TOKEN_HEADER);
        response.setHeader("Access-Control-Expose-Headers", TOKEN_HEADER);
        response.setHeader("Access-Control-Max-Age", "600");
    }

    private static void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setContentLength(REJECTION.length);
        response.getOutputStream().write(REJECTION);
    }

    private static byte[] randomToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }
}
