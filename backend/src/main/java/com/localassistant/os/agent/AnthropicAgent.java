package com.localassistant.os.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.error.ClientErrors;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.profile.ProfileLifecycle;
import com.localassistant.os.service.DashboardContextService;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Runs one chat turn against the Anthropic Messages API with Claude. Uses the JDK HTTP client
 * directly, so no additional SDK is bundled; the API key is only ever sent as a request header.
 */
@Component
public class AnthropicAgent {
    static final URI MESSAGES_ENDPOINT = URI.create("https://api.anthropic.com/v1/messages");
    static final String API_VERSION = "2023-06-01";
    /** Output budget per model call. Thinking counts toward it, so it is generous. */
    static final int MAX_OUTPUT_TOKENS = 32_000;
    /** Status codes worth one retry: timeouts, conflicts, rate limits, overload and server errors. */
    private static final Set<Integer> kRetryableStatus = Set.of(408, 409, 429, 500, 502, 503, 504, 529);
    private static final Duration kRetryBackoff = Duration.ofMillis(750);

    /** Sends one request; separated so tests can replace the network. */
    @FunctionalInterface
    interface Transport {
        HttpResponse<String> send(HttpRequest request) throws IOException, InterruptedException;
    }

    /**
     * An Anthropic API failure. The message is written here and never includes the response body
     * or the key; {@link ClientErrors} turns it into a stable code for the UI.
     */
    public static final class AnthropicApiException extends RuntimeException {
        private final int statusCode;
        private final String errorType;

        AnthropicApiException(int statusCode, String errorType, Throwable cause) {
            super(statusCode == 0
                    ? "Couldn't reach Anthropic."
                    : "Anthropic returned HTTP " + statusCode + (errorType.isBlank() ? "" : " (" + errorType + ")") + ".", cause);
            this.statusCode = statusCode;
            this.errorType = errorType;
        }

        /** HTTP status, or 0 when the request never got a response. */
        public int statusCode() {
            return statusCode;
        }

        public String errorType() {
            return errorType;
        }
    }

    private final ObjectMapper mapper = new ObjectMapper();
    private final AssistantProperties properties;
    private final DashboardContextService dashboardContext;
    private final AssistantToolRunner tools;
    private final HttpClient httpClient;
    private final Transport transport;
    private final ArrayNode toolDefinitions;

    @Autowired
    public AnthropicAgent(AssistantProperties properties, DashboardContextService dashboardContext, AssistantToolRunner tools) {
        this(properties, dashboardContext, tools, null);
    }

    AnthropicAgent(AssistantProperties properties, DashboardContextService dashboardContext, AssistantToolRunner tools, Transport transport) {
        this.properties = properties;
        this.dashboardContext = dashboardContext;
        this.tools = tools;
        this.httpClient = transport == null
                ? HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(15))
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .build()
                : null;
        this.transport = transport == null
                ? request -> httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                : transport;
        this.toolDefinitions = AssistantToolRunner.anthropicToolDefinitions(mapper);
    }

    public String model() {
        return properties.getAnthropicModel();
    }

    String reply(Conversation conversation, String key, long deadline) throws IOException {
        ArrayNode messages = mapper.createArrayNode();
        ObjectNode first = messages.addObject();
        first.put("role", "user");
        ArrayNode firstContent = first.putArray("content");
        for (String text : AgentPrompt.userInputs(conversation, dashboardContext)) {
            firstContent.addObject().put("type", "text").put("text", text);
        }

        for (int turn = 0; turn < AssistantAgent.MAX_MODEL_TURNS; turn++) {
            JsonNode response = send(requestBody(messages), key, deadline);
            JsonNode content = response.path("content");
            if (!content.isArray()) throw new AnthropicApiException(502, "invalid_response", null);

            if (!"tool_use".equals(response.path("stop_reason").asText())) {
                StringBuilder text = new StringBuilder();
                for (JsonNode block : content) {
                    if ("text".equals(block.path("type").asText())) text.append(block.path("text").asText());
                }
                if (text.isEmpty() && "refusal".equals(response.path("stop_reason").asText())) {
                    return "Claude declined to answer this request.";
                }
                return text.isEmpty() ? "I could not produce a text response." : text.toString();
            }

            // Send the assistant turn back unchanged; thinking blocks must keep their signatures.
            ObjectNode assistant = messages.addObject();
            assistant.put("role", "assistant");
            assistant.set("content", content);

            ObjectNode results = messages.addObject();
            results.put("role", "user");
            ArrayNode resultContent = results.putArray("content");
            for (JsonNode block : content) {
                if (!"tool_use".equals(block.path("type").asText())) continue;
                Object output;
                boolean failed = false;
                try {
                    output = tools.run(block.path("name").asText(), mapper.writeValueAsString(block.path("input")));
                } catch (Exception error) {
                    output = Map.of("error", ClientErrors.message(error));
                    failed = true;
                }
                ObjectNode result = resultContent.addObject();
                result.put("type", "tool_result");
                result.put("tool_use_id", block.path("id").asText());
                result.put("content", mapper.writeValueAsString(output));
                if (failed) result.put("is_error", true);
            }
            if (resultContent.isEmpty()) throw new AnthropicApiException(502, "invalid_response", null);
        }
        throw new IllegalStateException("The assistant exceeded the tool-call limit for one request.");
    }

    private String requestBody(ArrayNode messages) throws IOException {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", properties.getAnthropicModel());
        body.put("max_tokens", MAX_OUTPUT_TOKENS);
        body.put("system", AgentPrompt.SYSTEM_PROMPT);
        body.set("tools", toolDefinitions);
        body.putObject("thinking").put("type", "adaptive");
        body.putObject("output_config").put("effort", properties.getAnthropicEffort());
        body.set("messages", messages);
        return mapper.writeValueAsString(body);
    }

    private JsonNode send(String body, String key, long deadline) throws IOException {
        for (int attempt = 1; ; attempt++) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) throw new AssistantAgent.AgentDeadlineException();
            int attemptsLeft = AssistantAgent.MODEL_CALL_ATTEMPTS - attempt + 1;
            HttpRequest request = HttpRequest.newBuilder(MESSAGES_ENDPOINT)
                    .timeout(Duration.ofNanos(Math.max(1, remaining / attemptsLeft)))
                    .header("x-api-key", key)
                    .header("anthropic-version", API_VERSION)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response;
            // Don't hold the profile lease across the network call (issue #6).
            try (var suspended = ProfileLifecycle.suspend()) {
                response = transport.send(request);
            } catch (HttpTimeoutException error) {
                rethrowIfProfileDeleted(error);
                if (System.nanoTime() >= deadline) throw new AssistantAgent.AgentDeadlineException();
                if (attempt < AssistantAgent.MODEL_CALL_ATTEMPTS) continue;
                throw new AnthropicApiException(0, "timeout", error);
            } catch (IOException error) {
                rethrowIfProfileDeleted(error);
                if (System.nanoTime() >= deadline) throw new AssistantAgent.AgentDeadlineException();
                if (attempt < AssistantAgent.MODEL_CALL_ATTEMPTS) { pause(deadline); continue; }
                throw new AnthropicApiException(0, "connection_error", error);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                rethrowIfProfileDeleted(error);
                throw new AnthropicApiException(0, "interrupted", error);
            }

            int status = response.statusCode();
            if (status >= 200 && status < 300) {
                try {
                    return mapper.readTree(response.body());
                } catch (IOException parse) {
                    throw new AnthropicApiException(502, "invalid_response", null);
                }
            }
            if (kRetryableStatus.contains(status) && attempt < AssistantAgent.MODEL_CALL_ATTEMPTS) {
                pause(deadline);
                continue;
            }
            throw new AnthropicApiException(status, errorType(response.body()), null);
        }
    }

    /**
     * When the call fails and the profile was deleted meanwhile, closing the suspension throws
     * {@link ProfileLifecycle.ProfileDeletedException}, which Java attaches to the call's exception as suppressed.
     * The deletion wins over any retry or error mapping (issue #27).
     */
    private static void rethrowIfProfileDeleted(Exception error) {
        for (Throwable suppressed : error.getSuppressed()) {
            if (suppressed instanceof ProfileLifecycle.ProfileDeletedException deleted) throw deleted;
        }
    }

    /** Reads only the documented error.type field; the rest of the body is never surfaced. */
    private String errorType(String body) {
        try {
            String type = mapper.readTree(body).path("error").path("type").asText("");
            return type.matches("[a-z_]{1,64}") ? type : "";
        } catch (Exception ignored) {
            return "";
        }
    }

    private static void pause(long deadline) {
        long wait = Math.min(kRetryBackoff.toNanos(), Math.max(0, (deadline - System.nanoTime()) / 4));
        try {
            Thread.sleep(Duration.ofNanos(wait));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
    }

    @PreDestroy
    void close() {
        if (httpClient != null) httpClient.close();
    }
}
