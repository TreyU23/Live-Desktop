package com.localassistant.os.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class BridgeSecretTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    private static MockHttpServletResponse health(LocalAccessFilter filter, String bridge, String origin) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.setLocalPort(4317);
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("Host", "127.0.0.1:4317");
        if (origin != null) request.addHeader("Origin", origin);
        if (bridge != null) request.addHeader(LocalAccessFilter.BRIDGE_HEADER, bridge);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void tokenIsIssuedOnlyWithTheLaunchBridgeSecret() throws Exception {
        LocalAccessFilter filter = new LocalAccessFilter(SECRET);

        assertThat(health(filter, SECRET, null).getHeader(LocalAccessFilter.TOKEN_HEADER)).matches("[0-9a-f]{64}");
        assertThat(health(filter, null, "http://localhost:4173").getHeader(LocalAccessFilter.TOKEN_HEADER)).isNull();
        assertThat(health(filter, "wrong", "http://localhost:4173").getHeader(LocalAccessFilter.TOKEN_HEADER)).isNull();
        assertThat(health(filter, null, "http://localhost:4173").getStatus()).isEqualTo(200);
    }

    @Test
    void developmentWithoutASecretKeepsLoopbackBehavior() throws Exception {
        LocalAccessFilter filter = new LocalAccessFilter("");

        assertThat(health(filter, null, "http://localhost:4173").getHeader(LocalAccessFilter.TOKEN_HEADER))
                .matches("[0-9a-f]{64}");
    }
}
