package com.localassistant.os.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.localassistant.os.agent.OpenAiAgent;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.model.ConversationMessage;
import com.localassistant.os.service.ActionService;
import com.localassistant.os.service.ICloudCalendarService;
import com.localassistant.os.service.MemoryService;
import com.localassistant.os.service.ProfileCredentialStore;
import com.localassistant.os.service.ProfileDataService;
import com.localassistant.os.service.RuntimeService;
import com.localassistant.os.service.SystemService;
import com.localassistant.os.service.WindowsMediaSessionService;
import com.localassistant.os.store.StateStore;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Issue #20: two sends to the same conversation must not interleave their history. */
class ConcurrentChatTest {
    private static final String ID = "11111111-2222-4333-8444-555555555555";
    private static final Conversation CONVERSATION = new Conversation(ID, "Test", List.of(), "now", "now");

    private StateStore store;
    private OpenAiAgent agent;
    private AssistantController controller;

    @BeforeEach
    void setUp() throws Exception {
        store = mock(StateStore.class);
        agent = mock(OpenAiAgent.class);
        when(agent.configured()).thenReturn(true);
        when(store.getOrCreateConversation(any())).thenReturn(CONVERSATION);
        when(store.conversation(ID)).thenReturn(Optional.of(CONVERSATION));
        when(store.addMessage(eq(ID), any(), any()))
                .thenAnswer(call -> new ConversationMessage("m", call.getArgument(1), call.getArgument(2), "now"));
        controller = new AssistantController(store, agent, mock(ActionService.class), mock(MemoryService.class),
                mock(SystemService.class), mock(RuntimeService.class), mock(ICloudCalendarService.class),
                mock(WindowsMediaSessionService.class), mock(ProfileCredentialStore.class),
                mock(ProfileDataService.class));
    }

    @Test
    void secondSendWhileAReplyIsInFlightIsRejectedWithoutTouchingHistory() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(agent.reply(any())).thenAnswer(call -> {
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) throw new AssertionError("test deadline");
            return "first reply";
        });

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> controller.chat(new AssistantController.ChatRequest(ID, "one")));
            assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();

            var second = controller.chat(new AssistantController.ChatRequest(ID, "two"));
            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(((Map<?, ?>) second.getBody()).get("code")).isEqualTo("conversation_busy");
            verify(store, never()).addMessage(ID, "user", "two");

            release.countDown();
            assertThat(first.get(3, TimeUnit.SECONDS).getStatusCode()).isEqualTo(HttpStatus.OK);
        } finally {
            release.countDown();
        }

        // The claim is released once the turn ends, so the next send goes through.
        when(agent.reply(any())).thenReturn("second reply");
        assertThat(controller.chat(new AssistantController.ChatRequest(ID, "two")).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(store, times(1)).addMessage(ID, "user", "two");
    }

    @Test
    void claimIsReleasedWhenTheAgentFails() throws Exception {
        when(agent.reply(any())).thenThrow(new IllegalStateException("model unavailable"));
        assertThat(controller.chat(new AssistantController.ChatRequest(ID, "one")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_GATEWAY);

        org.mockito.Mockito.doReturn("ok").when(agent).reply(any());
        assertThat(controller.chat(new AssistantController.ChatRequest(ID, "two")).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void differentConversationsAndProfilesDoNotBlockEachOther() {
        var inFlight = new InFlightConversations();
        try (var a = inFlight.tryClaim("default", ID)) {
            assertThat(a).isNotNull();
            assertThat(inFlight.tryClaim("default", ID)).isNull();
            try (var otherConversation = inFlight.tryClaim("default", "other");
                    var otherProfile = inFlight.tryClaim("profile_b", ID)) {
                assertThat(otherConversation).isNotNull();
                assertThat(otherProfile).isNotNull();
            }
        }
        assertThat(inFlight.isBusy("default", ID)).isFalse();
    }
}
