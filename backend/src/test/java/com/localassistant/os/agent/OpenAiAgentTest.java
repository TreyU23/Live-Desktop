package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.profile.ProfileLifecycle;
import com.localassistant.os.service.DashboardContextService;
import com.openai.client.OpenAIClient;
import com.openai.core.RequestOptions;
import com.openai.core.http.Headers;
import com.openai.errors.BadRequestException;
import com.openai.errors.OpenAIIoException;
import com.openai.errors.RateLimitException;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseFunctionToolCall;
import com.openai.models.responses.ResponseIncludable;
import com.openai.models.responses.ResponseInputItem;
import com.openai.models.responses.ResponseOutputItem;
import com.openai.models.responses.ResponseOutputMessage;
import com.openai.models.responses.ResponseOutputText;
import com.openai.models.responses.ResponseReasoningItem;
import com.openai.models.responses.ResponseStatus;
import com.openai.models.responses.ResponseCreateParams;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OpenAiAgentTest {
    private static final Conversation CONVERSATION = new Conversation("c", "Test",
            List.of(new ConversationMessage("1", "user", "Hello", "now")), "now", "now");
    private final ExecutorService deleter = Executors.newSingleThreadExecutor();

    @AfterEach
    void shutdown() {
        deleter.shutdownNow();
    }

    @Test
    void profileDeletedDuringACallThatRanPastTheDeadlineIsReportedAsADeletion() throws Exception {
        // A deletion that lands while the call fails past the deadline used to come back as a timeout.
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        OpenAIClient client = mock(OpenAIClient.class, RETURNS_DEEP_STUBS);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        when(client.responses().create(any(ResponseCreateParams.class), any(RequestOptions.class))).thenAnswer(call -> {
            deleter.submit(() -> {
                ProfileLifecycle.exclusive("o31", () -> {});
                return null;
            }).get(5, TimeUnit.SECONDS);
            while (System.nanoTime() < deadline) Thread.sleep(5);
            throw new IllegalStateException("request timed out");
        });
        ProfileClientPool pool = mock(ProfileClientPool.class);
        ProfileClientPool.Lease lease = mock(ProfileClientPool.Lease.class);
        when(pool.acquire(any(), anyString())).thenReturn(lease);
        when(lease.client()).thenReturn(client);
        OpenAiAgent agent = new OpenAiAgent(new AssistantProperties(), dashboard, mock(AssistantToolRunner.class), pool);

        try (var held = ProfileLifecycle.acquire("o31")) {
            assertThatThrownBy(() -> agent.reply(CONVERSATION, "sk-test", deadline))
                    .isInstanceOf(ProfileLifecycle.ProfileDeletedException.class);
        }
    }

    // Retries are made by the agent, not the SDK, so a client-side timeout is never re-sent (issue #49).
    private static final long BUDGET = TimeUnit.SECONDS.toNanos(240);

    private OpenAIClient clientAnswering(Object... outcomes) {
        OpenAIClient client = mock(OpenAIClient.class, RETURNS_DEEP_STUBS);
        var stubbing = when(client.responses().create(any(ResponseCreateParams.class), any(RequestOptions.class)));
        for (Object outcome : outcomes) {
            stubbing = outcome instanceof Throwable error ? stubbing.thenThrow(error) : stubbing.thenReturn((Response) outcome);
        }
        return client;
    }

    private OpenAiAgent agentUsing(OpenAIClient client) {
        return agentUsing(client, mock(AssistantToolRunner.class));
    }

    private OpenAiAgent agentUsing(OpenAIClient client, AssistantToolRunner tools) {
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        ProfileClientPool pool = mock(ProfileClientPool.class);
        ProfileClientPool.Lease lease = mock(ProfileClientPool.Lease.class);
        when(pool.acquire(any(), anyString())).thenReturn(lease);
        when(lease.client()).thenReturn(client);
        return new OpenAiAgent(new AssistantProperties(), dashboard, tools, pool);
    }

    private static Response emptyReply() {
        Response response = mock(Response.class);
        when(response.output()).thenReturn(List.of());
        return response;
    }

    @Test
    void aConnectionErrorIsRetriedOnce() throws Exception {
        OpenAIClient client = clientAnswering(new OpenAIIoException("reset", new IOException("connection reset")), emptyReply());

        assertThat(agentUsing(client).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET))
                .isEqualTo("I could not produce a text response.");
        verify(client.responses(), times(2)).create(any(ResponseCreateParams.class), any(RequestOptions.class));
    }

    @Test
    void aRateLimitIsRetriedButABadRequestIsNot() throws Exception {
        OpenAIClient limited = clientAnswering(RateLimitException.builder().headers(Headers.builder().build()).build(), emptyReply());
        assertThat(agentUsing(limited).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET)).isNotBlank();
        verify(limited.responses(), times(2)).create(any(ResponseCreateParams.class), any(RequestOptions.class));

        OpenAIClient rejected = clientAnswering(BadRequestException.builder().headers(Headers.builder().build()).build(), emptyReply());
        assertThatThrownBy(() -> agentUsing(rejected).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET))
                .isInstanceOf(BadRequestException.class);
        verify(rejected.responses(), times(1)).create(any(ResponseCreateParams.class), any(RequestOptions.class));
    }

    @Test
    void aTimedOutCallIsReportedNotSentAgain() {
        OpenAIClient client = clientAnswering(
                new OpenAIIoException("timeout", new SocketTimeoutException("timeout")), emptyReply());

        assertThatThrownBy(() -> agentUsing(client).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET))
                .isInstanceOf(OpenAIIoException.class);
        verify(client.responses(), times(1)).create(any(ResponseCreateParams.class), any(RequestOptions.class));
    }

    @Test
    void theFirstCallMayUseAlmostTheWholeBudget() throws Exception {
        OpenAIClient client = clientAnswering(emptyReply());

        agentUsing(client).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET);

        ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
        verify(client.responses()).create(any(ResponseCreateParams.class), options.capture());
        assertThat(options.getValue().getTimeout().request()).isGreaterThan(AssistantAgent.AGENT_DEADLINE.minusSeconds(10));
    }

    // Reasoning must go back between tool rounds, and a reply cut off at the output limit must say so (issue #44).
    private static ResponseOutputItem reasoningItem() {
        ResponseOutputItem item = mock(ResponseOutputItem.class);
        when(item.isReasoning()).thenReturn(true);
        when(item.asReasoning()).thenReturn(ResponseReasoningItem.builder().id("rs_1").summary(List.of())
                .encryptedContent("opaque").build());
        return item;
    }

    private static ResponseOutputItem toolCallItem() {
        ResponseOutputItem item = mock(ResponseOutputItem.class);
        when(item.isFunctionCall()).thenReturn(true);
        when(item.asFunctionCall()).thenReturn(ResponseFunctionToolCall.builder()
                .callId("call_1").name("list_workspace_files").arguments("{}").build());
        return item;
    }

    private static ResponseOutputItem textItem(String text) {
        ResponseOutputText output = mock(ResponseOutputText.class);
        when(output.text()).thenReturn(text);
        ResponseOutputMessage.Content content = mock(ResponseOutputMessage.Content.class);
        when(content.outputText()).thenReturn(Optional.of(output));
        ResponseOutputMessage message = mock(ResponseOutputMessage.class);
        when(message.content()).thenReturn(List.of(content));
        ResponseOutputItem item = mock(ResponseOutputItem.class);
        when(item.message()).thenReturn(Optional.of(message));
        return item;
    }

    private static Response reply(ResponseStatus status, Response.IncompleteDetails.Reason cutOffBecause, ResponseOutputItem... items) {
        Response response = mock(Response.class);
        when(response.status()).thenReturn(Optional.of(status));
        when(response.incompleteDetails()).thenReturn(Optional.ofNullable(cutOffBecause)
                .map(reason -> Response.IncompleteDetails.builder().reason(reason).build()));
        when(response.output()).thenReturn(List.of(items));
        return response;
    }

    @Test
    void reasoningIsRequestedAndSentBackBeforeTheToolCallItLedTo() throws Exception {
        OpenAIClient client = clientAnswering(
                reply(ResponseStatus.COMPLETED, null, reasoningItem(), toolCallItem()), emptyReply());
        AssistantToolRunner tools = mock(AssistantToolRunner.class);
        when(tools.run(anyString(), any())).thenReturn(Map.of("files", List.of()));

        agentUsing(client, tools).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET);

        ArgumentCaptor<ResponseCreateParams> params = ArgumentCaptor.forClass(ResponseCreateParams.class);
        verify(client.responses(), times(2)).create(params.capture(), any(RequestOptions.class));
        assertThat(params.getAllValues().getFirst().include().orElseThrow())
                .contains(ResponseIncludable.REASONING_ENCRYPTED_CONTENT);
        List<ResponseInputItem> sent = params.getAllValues().getLast().input().orElseThrow().response().orElseThrow();
        assertThat(sent).extracting(item -> item.isMessage() ? "message" : item.isReasoning() ? "reasoning"
                : item.isFunctionCall() ? "function_call" : item.isFunctionCallOutput() ? "function_call_output" : "other")
                .containsExactly("message", "reasoning", "function_call", "function_call_output");
    }

    @Test
    void aReplyCutOffAtTheOutputLimitSaysSoAndRunsNoTool() throws Exception {
        AssistantToolRunner tools = mock(AssistantToolRunner.class);
        OpenAIClient withText = clientAnswering(reply(ResponseStatus.INCOMPLETE,
                Response.IncompleteDetails.Reason.MAX_OUTPUT_TOKENS, textItem("Step one, then step  "), toolCallItem()));
        OpenAIClient withoutText = clientAnswering(reply(ResponseStatus.INCOMPLETE,
                Response.IncompleteDetails.Reason.MAX_OUTPUT_TOKENS, reasoningItem(), toolCallItem()));

        assertThat(agentUsing(withText, tools).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET))
                .isEqualTo("Step one, then step\n\n" + AssistantAgent.kTruncatedNote);
        assertThat(agentUsing(withoutText, tools).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET))
                .isEqualTo(AssistantAgent.kTruncatedWithoutText);
        verify(tools, never()).run(anyString(), any());
        verify(withText.responses(), times(1)).create(any(ResponseCreateParams.class), any(RequestOptions.class));
    }

    @Test
    void aCompleteReplyDoesNotGetTheCutOffNote() throws Exception {
        OpenAIClient client = clientAnswering(reply(ResponseStatus.COMPLETED, null, textItem("All done.")));

        assertThat(agentUsing(client).reply(CONVERSATION, "sk-test", System.nanoTime() + BUDGET)).isEqualTo("All done.");
    }
}
