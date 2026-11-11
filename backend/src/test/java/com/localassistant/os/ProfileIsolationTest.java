package com.localassistant.os;

import static org.assertj.core.api.Assertions.assertThat;

import com.localassistant.os.web.LocalAccessClients;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "assistant.data-dir=target/profile-isolation-data", "assistant.workspace-root=.", "assistant.openai-api-key="
})
class ProfileIsolationTest {
    @LocalServerPort int port;
    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void memoriesAreIsolatedByProfileHeader() throws Exception {
        String first = "test_" + UUID.randomUUID().toString().replace("-", "");
        String second = "test_" + UUID.randomUUID().toString().replace("-", "");
        String marker = "profile-only-" + UUID.randomUUID();

        HttpResponse<String> created = client.send(request("/api/memories", first)
                        .POST(HttpRequest.BodyPublishers.ofString("{\"content\":\"" + marker + "\",\"category\":\"fact\"}"))
                        .build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> firstList = client.send(request("/api/memories", first).GET().build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> secondList = client.send(request("/api/memories", second).GET().build(), HttpResponse.BodyHandlers.ofString());

        assertThat(created.statusCode()).isEqualTo(201);
        assertThat(firstList.body()).contains(marker);
        assertThat(secondList.body()).doesNotContain(marker);
    }

    private HttpRequest.Builder request(String path, String profileId) throws Exception {
        return LocalAccessClients.request(port, path, LocalAccessClients.token(port))
                .header("X-Profile-Id", profileId);
    }
}
