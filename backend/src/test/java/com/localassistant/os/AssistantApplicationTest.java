package com.localassistant.os;

import static org.assertj.core.api.Assertions.assertThat;

import com.localassistant.os.web.LocalAccessClients;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "assistant.data-dir=target/test-data",
        "assistant.workspace-root=.",
        "assistant.openai-api-key="
})
class AssistantApplicationTest {
    @LocalServerPort
    int port;

    @Test
    void healthEndpointReportsAnUnconfiguredClient() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/health")).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        String token = response.headers().firstValue("X-Live-Desktop-Token").orElseThrow();
        assertThat(token).matches("[0-9a-f]{64}");
        assertThat(response.body()).contains("\"status\":\"ok\"").doesNotContain(token);
        assertThat(response.body()).contains("\"openAiConfigured\":false");
    }

    @Test
    void chatEndpointRequiresAnApiKey() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                LocalAccessClients.request(port, "/api/chat", LocalAccessClients.token(port))
                        .POST(HttpRequest.BodyPublishers.ofString("{\"message\":\"hello\"}"))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(503);
        assertThat(response.body()).contains("OPENAI_API_KEY is not configured");
    }

    @Test
    void runtimeEndpointReportsTheLocalBackend() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                LocalAccessClients.request(port, "/api/runtime", LocalAccessClients.token(port)).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"backendOnline\":true");
        assertThat(response.body()).contains("\"capturedAt\"");
    }

    @Test
    void systemEndpointIncludesDeviceAndWindowsSpecifications() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                LocalAccessClients.request(port, "/api/system", LocalAccessClients.token(port)).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"device\"");
        assertThat(response.body()).contains("\"processorName\"");
        assertThat(response.body()).contains("\"graphics\"");
        assertThat(response.body()).contains("\"windows\"");
        assertThat(response.body()).contains("\"edition\"");
        assertThat(response.body()).contains("\"build\"");
    }

    @Test
    void iCloudCalendarStartsDisconnectedWithoutStoredCredentials() throws Exception {
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                LocalAccessClients.request(port, "/api/integrations/icloud-calendar?date=2026-08-02",
                        LocalAccessClients.token(port)).GET().build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"connected\":false");
        assertThat(response.body()).contains("\"date\":\"2026-08-02\"");
        assertThat(response.body()).contains("\"events\":[]");
    }
}
