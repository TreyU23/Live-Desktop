package com.localassistant.os.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "assistant.data-dir=target/local-access-data",
        "assistant.workspace-root=.",
        "assistant.openai-api-key="
})
class LocalAccessFilterTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient client = HttpClient.newHttpClient();

    @LocalServerPort
    int port;

    @Test
    void healthIssuesTheLaunchTokenWithoutPuttingItInTheBody() throws Exception {
        HttpResponse<String> response = client.send(get("/health"), HttpResponse.BodyHandlers.ofString());

        String token = response.headers().firstValue(LocalAccessFilter.TOKEN_HEADER).orElseThrow();
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(token).matches("[0-9a-f]{64}");
        assertThat(response.body()).contains("\"status\":\"ok\"").doesNotContain(token);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(response.headers().firstValue("Access-Control-Allow-Private-Network")).isEmpty();
    }

    @Test
    void forgedHostCannotReadActionsEvenWithTheLaunchToken() throws Exception {
        String token = LocalAccessClients.token(port);
        HttpResponse<String> created = client.send(authorized("/api/integrations/media-session/open-external?provider=spotify")
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        String id = JSON.readTree(created.body()).get("id").asText();

        String forged = exchange("GET /api/actions HTTP/1.1\r\nHost: attacker.example:" + port
                + "\r\n" + LocalAccessFilter.TOKEN_HEADER + ": " + token + "\r\nConnection: close\r\n\r\n");
        String unported = exchange("GET /api/actions HTTP/1.1\r\nHost: attacker.example\r\nConnection: close\r\n\r\n");

        assertThat(statusOf(forged)).isEqualTo(403);
        assertThat(forged).contains("Local access only").doesNotContain(id).doesNotContain(token);
        assertThat(statusOf(unported)).isEqualTo(403);
        assertThat(unported).doesNotContain(id);
    }

    @Test
    void crossOriginPostWithoutABodyDoesNotCreateActions() throws Exception {
        int before = actionCount();

        HttpResponse<String> spotify = client.send(post(
                "/api/integrations/media-session/open-external?provider=spotify", "https://attacker.example"),
                HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> calendar = client.send(post(
                "/api/integrations/icloud-calendar/open-web", "https://attacker.example"),
                HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> stolen = client.send(authorized("/api/integrations/media-session/open-external?provider=spotify")
                .header("Origin", "https://attacker.example")
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());

        assertThat(spotify.statusCode()).isEqualTo(403);
        assertThat(calendar.statusCode()).isEqualTo(403);
        assertThat(stolen.statusCode()).isEqualTo(403);
        assertThat(spotify.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(spotify.body()).doesNotContain("spotify:");
        assertThat(calendar.body()).doesNotContain("icloud.com");
        assertThat(actionCount()).isEqualTo(before);
    }

    @Test
    void crossOriginApprovalDoesNotRunTheAction() throws Exception {
        HttpResponse<String> created = client.send(authorized("/api/integrations/media-session/open-external?provider=spotify")
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        String id = JSON.readTree(created.body()).get("id").asText();

        HttpResponse<String> attacked = client.send(post("/api/actions/" + id + "/approve", "https://attacker.example"),
                HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> listed = client.send(authorized("/api/actions").GET().build(), HttpResponse.BodyHandlers.ofString());

        assertThat(created.statusCode()).isEqualTo(202);
        assertThat(attacked.statusCode()).isEqualTo(403);
        assertThat(attacked.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
        assertThat(listed.body()).contains("\"id\":\"" + id + "\"").contains("\"status\":\"pending\"");
        assertThat(listed.body()).doesNotContain("\"status\":\"approved\"").doesNotContain("\"status\":\"completed\"");
    }

    @Test
    void mutatingRequestsRequireJsonEvenWithTheLaunchToken() throws Exception {
        String token = LocalAccessClients.token(port);
        int before = actionCount();

        HttpResponse<String> missing = client.send(HttpRequest.newBuilder(endpoint(
                "/api/integrations/icloud-calendar/open-web"))
                .header(LocalAccessFilter.TOKEN_HEADER, token)
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> plain = client.send(HttpRequest.newBuilder(endpoint(
                "/api/integrations/media-session/open-external?provider=spotify"))
                .header(LocalAccessFilter.TOKEN_HEADER, token)
                .header("Content-Type", "text/plain")
                .POST(HttpRequest.BodyPublishers.ofString("spotify")).build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> form = client.send(HttpRequest.newBuilder(endpoint("/api/integrations/icloud-calendar/open-web"))
                .header(LocalAccessFilter.TOKEN_HEADER, token)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("provider=spotify")).build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> deleted = client.send(HttpRequest.newBuilder(endpoint("/api/memories/missing"))
                .header(LocalAccessFilter.TOKEN_HEADER, token)
                .DELETE().build(), HttpResponse.BodyHandlers.ofString());

        assertThat(missing.statusCode()).isEqualTo(403);
        assertThat(plain.statusCode()).isEqualTo(403);
        assertThat(form.statusCode()).isEqualTo(403);
        assertThat(deleted.statusCode()).isEqualTo(403);
        assertThat(actionCount()).isEqualTo(before);
    }

    @Test
    void dashboardOriginCanCallWithTheTokenAndJsonContentType() throws Exception {
        HttpResponse<String> created = client.send(HttpRequest.newBuilder(endpoint("/api/integrations/icloud-calendar/open-web"))
                .header(LocalAccessFilter.TOKEN_HEADER, LocalAccessClients.token(port))
                .header("Origin", "http://127.0.0.1:4173")
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> preflight = client.send(HttpRequest.newBuilder(endpoint("/api/actions/missing/reject"))
                .header("Origin", "http://localhost:4173")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type, x-live-desktop-token")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> foreignPreflight = client.send(HttpRequest.newBuilder(endpoint("/api/actions/missing/approve"))
                .header("Origin", "https://attacker.example")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());

        assertThat(created.statusCode()).isEqualTo(202);
        assertThat(created.body()).contains("\"status\":\"pending\"");
        assertThat(created.headers().firstValue("Access-Control-Allow-Origin")).contains("http://127.0.0.1:4173");
        assertThat(created.headers().firstValue("Access-Control-Allow-Private-Network")).isEmpty();
        assertThat(preflight.statusCode()).isEqualTo(204);
        assertThat(preflight.headers().firstValue("Access-Control-Allow-Origin")).contains("http://localhost:4173");
        assertThat(preflight.headers().firstValue("Access-Control-Allow-Headers").orElseThrow())
                .contains(LocalAccessFilter.TOKEN_HEADER);
        assertThat(foreignPreflight.statusCode()).isEqualTo(403);
        assertThat(foreignPreflight.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
    }

    @Test
    void wrongPortEmptyOriginAndWrongTokenAreRejected() throws Exception {
        String token = LocalAccessClients.token(port);
        String wrongPort = exchange("GET /api/actions HTTP/1.1\r\nHost: 127.0.0.1:80\r\nConnection: close\r\n\r\n");
        String emptyOrigin = exchange("GET /api/actions HTTP/1.1\r\nHost: 127.0.0.1:" + port
                + "\r\nOrigin: \r\n" + LocalAccessFilter.TOKEN_HEADER + ": " + token + "\r\nConnection: close\r\n\r\n");
        HttpResponse<String> nullOrigin = client.send(HttpRequest.newBuilder(endpoint("/health"))
                .header("Origin", "null").GET().build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> evilHealth = client.send(HttpRequest.newBuilder(endpoint("/health"))
                .header("Origin", "https://attacker.example").GET().build(), HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> wrongToken = client.send(HttpRequest.newBuilder(endpoint("/api/actions"))
                .header(LocalAccessFilter.TOKEN_HEADER, "0".repeat(64))
                .GET().build(), HttpResponse.BodyHandlers.ofString());
        String localhost = exchange("GET /health HTTP/1.1\r\nHost: localhost:" + port + "\r\nConnection: close\r\n\r\n");

        assertThat(statusOf(wrongPort)).isEqualTo(403);
        assertThat(statusOf(emptyOrigin)).isEqualTo(403);
        assertThat(emptyOrigin).doesNotContain(token);
        assertThat(nullOrigin.statusCode()).isEqualTo(403);
        assertThat(nullOrigin.headers().firstValue(LocalAccessFilter.TOKEN_HEADER)).isEmpty();
        assertThat(nullOrigin.body()).doesNotContain(LocalAccessClients.token(port));
        assertThat(evilHealth.statusCode()).isEqualTo(403);
        assertThat(evilHealth.headers().firstValue(LocalAccessFilter.TOKEN_HEADER)).isEmpty();
        assertThat(evilHealth.body()).doesNotContain(LocalAccessClients.token(port));
        assertThat(wrongToken.statusCode()).isEqualTo(403);
        assertThat(statusOf(localhost)).isEqualTo(200);
        assertThat(localhost).contains(LocalAccessClients.token(port));
    }

    private int actionCount() throws Exception {
        HttpResponse<String> listed = client.send(authorized("/api/actions").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(listed.statusCode()).isEqualTo(200);
        return JSON.readTree(listed.body()).size();
    }

    private HttpRequest.Builder authorized(String path) throws Exception {
        return LocalAccessClients.request(port, path, LocalAccessClients.token(port));
    }

    private HttpRequest get(String path) {
        return HttpRequest.newBuilder(endpoint(path)).GET().build();
    }

    private HttpRequest post(String path, String origin) {
        return HttpRequest.newBuilder(endpoint(path)).header("Origin", origin)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
    }

    private URI endpoint(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }

    private String exchange(String request) throws Exception {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", port), 3000);
            socket.setSoTimeout(3000);
            socket.getOutputStream().write(request.getBytes(StandardCharsets.US_ASCII));
            socket.getOutputStream().flush();
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            try (InputStream input = socket.getInputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = input.read(buffer)) >= 0) body.write(buffer, 0, read);
            } catch (SocketTimeoutException exception) {
                if (body.size() == 0) throw exception;
            }
            return body.toString(StandardCharsets.UTF_8);
        }
    }

    private static int statusOf(String response) {
        int first = response.indexOf(' ');
        int second = response.indexOf(' ', first + 1);
        return Integer.parseInt(response.substring(first + 1, second));
    }
}
