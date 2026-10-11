package com.localassistant.os.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Opt-in, bounded, non-content diagnostics. No response or credential values. */
@Component
public class PerformanceFilter extends OncePerRequestFilter {
    private final boolean enabled = "1".equals(System.getenv("LIVE_DESKTOP_DIAGNOSTICS"));
    private final java.util.concurrent.atomic.AtomicInteger count = new java.util.concurrent.atomic.AtomicInteger();
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws java.io.IOException, jakarta.servlet.ServletException {
        if (!enabled) { chain.doFilter(request, response); return; }
        long start = System.nanoTime();
        try { chain.doFilter(request, response); }
        finally {
            if (count.getAndIncrement() < 1000) {
                String path = request.getRequestURI();
                String route = java.util.List.of("/health", "/api/system", "/api/integrations", "/api/actions",
                        "/api/memories", "/api/conversations", "/api/chat", "/api/profile", "/api/runtime")
                        .stream().filter(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"))
                        .findFirst().orElse("other");
                System.out.printf(java.util.Locale.ROOT, "PERF route=%s status=%d duration_ms=%.3f%n", route, response.getStatus(), (System.nanoTime() - start) / 1_000_000.0);
            }
        }
    }
}
