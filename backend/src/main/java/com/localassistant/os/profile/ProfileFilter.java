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
        // DELETE requests take an exclusive profile lease even when the servlet
        // container normalizes encoded paths or matrix parameters for routing.
        boolean deleting = request.getMethod().equals("DELETE");
        try (var lease = ProfileLifecycle.acquire(ProfileContext.currentId(), deleting)) {
            chain.doFilter(request, response);
        } finally {
            ProfileContext.clear();
        }
    }
}
