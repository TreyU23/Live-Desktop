package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
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
import com.openai.models.responses.ResponseCreateParams;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.List;
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
        DashboardContextService dashboard = mock(DashboardContextService.class);
        when(dashboard.contextForPrompt(anyString())).thenReturn("");
        ProfileClientPool pool = mock(ProfileClientPool.class);
        ProfileClientPool.Lease lease = mock(ProfileClientPool.Lease.class);
        when(pool.acquire(any(), anyString())).thenReturn(lease);
        when(lease.client()).thenReturn(client);
        return new OpenAiAgent(new AssistantProperties(), dashboard, mock(AssistantToolRunner.class), pool);
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
}
