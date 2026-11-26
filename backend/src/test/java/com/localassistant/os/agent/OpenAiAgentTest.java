package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.profile.ProfileLifecycle;
import com.localassistant.os.service.DashboardContextService;
import com.openai.client.OpenAIClient;
import com.openai.core.RequestOptions;
import com.openai.models.responses.ResponseCreateParams;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

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
}
