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
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        ProfileContext.set(request.getHeader("X-Profile-Id"));
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
