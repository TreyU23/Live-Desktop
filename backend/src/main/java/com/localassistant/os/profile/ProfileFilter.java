package com.localassistant.os.profile;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ProfileFilter extends OncePerRequestFilter {
    public static final String PROFILE_HEADER = "X-Profile-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var profile = ProfileContext.parse(request.getHeader(PROFILE_HEADER));
        if (profile.isEmpty()) {
            // Refuse rather than fall back to the default profile, which would hand this caller its data.
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"X-Profile-Id is not a valid profile id.\",\"code\":\"invalid_profile\"}");
            return;
        }
        ProfileContext.set(profile.get());
        // Every request holds a shared lease. Profile deletion upgrades to the
        // exclusive lock inside ProfileDataService, so the decision does not depend
        // on how the servlet container normalizes the path or the HTTP verb.
        try (var lease = ProfileLifecycle.acquire(ProfileContext.currentId())) {
            chain.doFilter(request, response);
        } finally {
            ProfileContext.clear();
        }
    }
}
