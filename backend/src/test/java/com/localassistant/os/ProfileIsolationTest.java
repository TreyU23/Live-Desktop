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
        String first = UUID.randomUUID().toString().replace("-", "_");
        String second = UUID.randomUUID().toString().replace("-", "_");
        String marker = "profile-only-" + UUID.randomUUID();

        HttpResponse<String> created = client.send(request("/api/memories", first)
                        .POST(HttpRequest.BodyPublishers.ofString("{\"content\":\"" + marker + "\",\"category\":\"fact\"}"))
                        .build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> firstList = client.send(request("/api/memories", first).GET().build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> secondList = client.send(request("/api/memories", second).GET().build(), HttpResponse.BodyHandlers.ofString());

        assertThat(created.statusCode()).isEqualTo(201);
        assertThat(firstList.body()).contains(marker);
        assertThat(secondList.body()).doesNotContain(marker);

        // Profile folders are capped (issue #18) and this data folder outlives the run, so remove ours.
        HttpResponse<String> deleted = client.send(request("/api/profile/data", first).DELETE().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(deleted.statusCode()).isEqualTo(204);
    }

    @Test
    void malformedProfileIdsAreRefusedInsteadOfFallingBackToDefault() throws Exception {
        for (String profile : new String[] {"../escape", "test_abc", "x".repeat(40)}) {
            HttpResponse<String> response = client.send(request("/api/memories", profile).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(response.body()).contains("invalid_profile");
        }
    }

    private HttpRequest.Builder request(String path, String profileId) throws Exception {
        return LocalAccessClients.request(port, path, LocalAccessClients.token(port))
                .header("X-Profile-Id", profileId);
    }
}
