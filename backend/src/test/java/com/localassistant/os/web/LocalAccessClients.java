package com.localassistant.os.web;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class LocalAccessClients {
    private static final HttpClient CLIENT = HttpClient.newHttpClient();

    private LocalAccessClients() {}

    public static String token(int port) throws Exception {
        HttpResponse<String> response = CLIENT.send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/health")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("GET /health returned " + response.statusCode());
        }
        return response.headers().firstValue(LocalAccessFilter.TOKEN_HEADER)
                .filter(value -> value.matches("[0-9a-f]{64}"))
                .orElseThrow(() -> new IllegalStateException("Local access token was not issued"));
    }

    public static HttpRequest.Builder request(int port, String path, String token) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .header(LocalAccessFilter.TOKEN_HEADER, token)
                .header("Content-Type", "application/json");
    }
}
