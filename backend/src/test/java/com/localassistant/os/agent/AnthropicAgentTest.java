package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.error.ClientErrors;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.profile.ProfileLifecycle;
import com.localassistant.os.service.DashboardContextService;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AnthropicAgentTest {
    private static final String KEY = "sk-ant-test-key-0123456789";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Conversation CONVERSATION = new Conversation("c", "Test",
            List.of(new ConversationMessage("1", "user", "What's in the workspace?", "now")), "now", "now");

    private final List<HttpRequest> requests = new ArrayList<>();
    private final List<String> bodies = new ArrayList<>();
    private final List<HttpResponse<String>> replies = new ArrayList<>();
    private AssistantToolRunner tools;
    private AnthropicAgent agent;

    @BeforeEach
    void setUp() {
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        tools = mock(AssistantToolRunner.class);
        agent = new AnthropicAgent(new AssistantProperties(), dashboard, tools, request -> {
            requests.add(request);
            bodies.add(body(request));
            return replies.remove(0);
        });
    }

    @Test
    void runsToolsThenReturnsClaudesTextUsingSonnet55() throws Exception {
        replies.add(response(200, """
                {"stop_reason":"tool_use","content":[
                  {"type":"thinking","thinking":"plan","signature":"sig-1"},
                  {"type":"tool_use","id":"toolu_1","name":"list_workspace_files","input":{"subdirectory":".","limit":5}}]}"""));
        replies.add(response(200, """
                {"stop_reason":"end_turn","content":[{"type":"text","text":"Two files."}]}"""));
        when(tools.run(eq("list_workspace_files"), anyString())).thenReturn(Map.of("files", List.of("a", "b")));

        String reply = agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos());

        assertThat(reply).isEqualTo("Two files.");
        assertThat(requests).hasSize(2);
        HttpRequest first = requests.getFirst();
        assertThat(first.uri()).isEqualTo(AnthropicAgent.MESSAGES_ENDPOINT);
        assertThat(first.headers().firstValue("x-api-key")).contains(KEY);
        assertThat(first.headers().firstValue("anthropic-version")).contains(AnthropicAgent.API_VERSION);
        assertThat(first.headers().firstValue("authorization")).isEmpty();

        JsonNode request = JSON.readTree(bodies.getFirst());
        assertThat(request.path("model").asText()).isEqualTo("claude-sonnet-5-5");
        assertThat(request.path("thinking").path("type").asText()).isEqualTo("adaptive");
        assertThat(request.path("output_config").path("effort").asText()).isEqualTo("medium");
        assertThat(request.path("system").asText()).contains("local-first Windows assistant");
        assertThat(request.path("tools")).hasSize(AssistantToolRunner.TOOLS.size());
        assertThat(bodies.getFirst()).doesNotContain(KEY);

        JsonNode followUp = JSON.readTree(bodies.get(1)).path("messages");
        assertThat(followUp).hasSize(3);
        // The assistant turn goes back unchanged, thinking signature included.
        assertThat(followUp.get(1).path("content").get(0).path("signature").asText()).isEqualTo("sig-1");
        JsonNode result = followUp.get(2).path("content").get(0);
        assertThat(result.path("type").asText()).isEqualTo("tool_result");
        assertThat(result.path("tool_use_id").asText()).isEqualTo("toolu_1");
        assertThat(result.path("content").asText()).contains("\"files\"");
        verify(tools).run("list_workspace_files", "{\"subdirectory\":\".\",\"limit\":5}");
    }

    @Test
    void toolFailuresAreReportedToClaudeAsErrors() throws Exception {
        replies.add(response(200, """
                {"stop_reason":"tool_use","content":[{"type":"tool_use","id":"toolu_9","name":"read_workspace_file","input":{"path":"../secret"}}]}"""));
        replies.add(response(200, """
                {"stop_reason":"end_turn","content":[{"type":"text","text":"I can't read that."}]}"""));
        when(tools.run(eq("read_workspace_file"), anyString()))
                .thenThrow(new IllegalArgumentException("Path is outside the configured workspace."));

        assertThat(agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                .isEqualTo("I can't read that.");
        JsonNode result = JSON.readTree(bodies.get(1)).path("messages").get(2).path("content").get(0);
        assertThat(result.path("is_error").asBoolean()).isTrue();
        assertThat(result.path("content").asText()).contains("outside the configured workspace");
    }

    @Test
    void rejectedKeyBecomesAStableCodeWithoutTheResponseBody() throws Exception {
        replies.add(response(401, """
                {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key sk-ant-test-key-0123456789"}}"""));

        assertThatThrownBy(() -> agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                .isInstanceOfSatisfying(AnthropicAgent.AnthropicApiException.class, error -> {
                    assertThat(error.statusCode()).isEqualTo(401);
                    assertThat(error.errorType()).isEqualTo("authentication_error");
                    var described = ClientErrors.describe(error);
                    assertThat(described.code()).isEqualTo("anthropic_unauthorized");
                    assertThat(described.message()).doesNotContain("sk-ant");
                });
        verify(tools, never()).run(anyString(), any());
    }

    @Test
    void overloadIsRetriedOnce() throws Exception {
        replies.add(response(529, "{\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\"}}"));
        replies.add(response(200, "{\"stop_reason\":\"end_turn\",\"content\":[{\"type\":\"text\",\"text\":\"ok\"}]}"));

        assertThat(agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos())).isEqualTo("ok");
        assertThat(requests).hasSize(2);
    }

    @Test
    void aTimedOutCallIsReportedNotSentAgain() throws Exception {
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        AtomicInteger calls = new AtomicInteger();
        AnthropicAgent slow = new AnthropicAgent(new AssistantProperties(), dashboard, tools, request -> {
            calls.incrementAndGet();
            throw new java.net.http.HttpTimeoutException("request timed out");
        });

        assertThatThrownBy(() -> slow.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                .isInstanceOfSatisfying(AnthropicAgent.AnthropicApiException.class, error -> {
                    assertThat(error.statusCode()).isZero();
                    assertThat(error.errorType()).isEqualTo("timeout");
                });
        assertThat(calls).hasValue(1);
    }

    @Test
    void theFirstCallMayUseAlmostTheWholeBudget() throws Exception {
        replies.add(response(200, "{\"stop_reason\":\"end_turn\",\"content\":[{\"type\":\"text\",\"text\":\"ok\"}]}"));

        agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos());

        assertThat(requests.getFirst().timeout().orElseThrow())
                .isGreaterThan(AssistantAgent.AGENT_DEADLINE.minusSeconds(10));
    }

    @Test
    void profileDeletedDuringAFailedCallIsNotLostToTheRetry() throws Exception {
        // Issue #27: the deletion arrives as a suppressed exception on the I/O error and must not be retried away.
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        AtomicInteger calls = new AtomicInteger();
        ExecutorService deleter = Executors.newSingleThreadExecutor();
        try {
            AnthropicAgent deleting = new AnthropicAgent(new AssistantProperties(), dashboard, tools, request -> {
                if (calls.incrementAndGet() == 1) {
                    try {
                        deleter.submit(() -> {
                            ProfileLifecycle.exclusive("a27", () -> {});
                            return null;
                        }).get(5, TimeUnit.SECONDS);
                    } catch (ExecutionException | TimeoutException error) {
                        throw new AssertionError(error);
                    }
                    throw new IOException("connection reset");
                }
                return response(200, "{\"stop_reason\":\"end_turn\",\"content\":[{\"type\":\"text\",\"text\":\"ok\"}]}");
            });
            try (var lease = ProfileLifecycle.acquire("a27")) {
                assertThatThrownBy(() -> deleting.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                        .isInstanceOf(ProfileLifecycle.ProfileDeletedException.class);
            }
            assertThat(calls).hasValue(1);
        } finally {
            deleter.shutdownNow();
        }
    }

    @Test
    void replyCutOffAtMaxTokensSaysSo() throws Exception {
        // Issue #28: a max_tokens stop is not a finished answer.
        replies.add(response(200, """
                {"stop_reason":"max_tokens","content":[{"type":"thinking","thinking":"t","signature":"s"},
                  {"type":"text","text":"Step one, then step  "}]}"""));

        assertThat(agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                .isEqualTo("Step one, then step\n\n" + AnthropicAgent.kTruncatedNote);
        assertThat(requests).hasSize(1);
    }

    @Test
    void cutOffInsideThinkingOrAToolCallDoesNotRunTheTool() throws Exception {
        replies.add(response(200, """
                {"stop_reason":"max_tokens","content":[{"type":"thinking","thinking":"t","signature":"s"},
                  {"type":"tool_use","id":"toolu_2","name":"list_workspace_files","input":{}}]}"""));

        assertThat(agent.reply(CONVERSATION, KEY, System.nanoTime() + AssistantAgent.AGENT_DEADLINE.toNanos()))
                .isEqualTo(AnthropicAgent.kTruncatedWithoutText);
        verify(tools, never()).run(anyString(), any());
    }

    @Test
    void toolDefinitionsMatchTheAnnotatedToolClasses() {
        JsonNode definitions = AssistantToolRunner.anthropicToolDefinitions(JSON);
        assertThat(definitions).hasSize(7);
        JsonNode dashboard = null;
        for (JsonNode tool : definitions) if ("get_dashboard_context".equals(tool.path("name").asText())) dashboard = tool;
        assertThat(dashboard).isNotNull();
        assertThat(dashboard.path("description").asText()).contains("Valid topics");
        JsonNode topics = dashboard.path("input_schema").path("properties").path("topics");
        assertThat(topics.path("type").asText()).isEqualTo("array");
        assertThat(topics.path("items").path("type").asText()).isEqualTo("string");
        assertThat(dashboard.path("input_schema").path("additionalProperties").asBoolean(true)).isFalse();
    }

    private static String body(HttpRequest request) {
        var publisher = request.bodyPublisher().orElseThrow();
        var collected = new StringBuilder();
        publisher.subscribe(new Flow.Subscriber<>() {
            @Override public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            @Override public void onNext(ByteBuffer item) { collected.append(StandardCharsets.UTF_8.decode(item)); }
            @Override public void onError(Throwable throwable) { throw new AssertionError(throwable); }
            @Override public void onComplete() {}
        });
        return collected.toString();
    }

    private static HttpResponse<String> response(int status, String body) {
        return new HttpResponse<>() {
            @Override public int statusCode() { return status; }
            @Override public HttpRequest request() { return null; }
            @Override public Optional<HttpResponse<String>> previousResponse() { return Optional.empty(); }
            @Override public HttpHeaders headers() { return HttpHeaders.of(Map.of(), (a, b) -> true); }
            @Override public String body() { return body; }
            @Override public Optional<SSLSession> sslSession() { return Optional.empty(); }
            @Override public java.net.URI uri() { return AnthropicAgent.MESSAGES_ENDPOINT; }
            @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
        };
    }
}
