package com.localassistant.os.agent;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.model.Conversation;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.service.ProfileCredentialStore;
import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Chooses the active profile's model provider (OpenAI or Anthropic) and runs a chat turn with it.
 * Keys are per profile; only the original local profile falls back to keys from the environment.
 */
@Service
public class AssistantAgent {
    /**
     * Overall budget for one chat request, all model turns and tool calls included. The native
     * host's /api/chat upstream timeout (native/host/main.cpp, kChatUpstreamTimeoutMs) must stay
     * above this, so the UI always receives the backend's real outcome (issue #11).
     */
    public static final Duration AGENT_DEADLINE = Duration.ofSeconds(240);
    /** One try plus the retries of {@link ProfileClientPool#MAX_RETRIES}; each attempt may use all the time left. */
    static final int MODEL_CALL_ATTEMPTS = ProfileClientPool.MAX_RETRIES + 1;
    /** Status codes worth one retry: request timeouts, conflicts, rate limits, overload and server errors. */
    static final java.util.Set<Integer> RETRYABLE_STATUS = java.util.Set.of(408, 409, 429, 500, 502, 503, 504, 529);
    private static final Duration kRetryBackoff = Duration.ofMillis(750);

    /** Short pause before a retry, never longer than a quarter of the time left. */
    static void pauseBeforeRetry(long deadline) {
        long wait = Math.min(kRetryBackoff.toNanos(), Math.max(0, (deadline - System.nanoTime()) / 4));
        try {
            Thread.sleep(Duration.ofNanos(wait));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
    }
    static final String kTruncatedNote = "(This reply was cut off because it reached the length limit. Ask me to continue, or for a shorter answer.)";
    static final String kTruncatedWithoutText = "My reply reached the length limit before I could finish it, so nothing was done. Try a shorter request or split it into steps.";
    /** Model calls allowed in one request before it stops with a tool-call limit error. */
    static final int MAX_MODEL_TURNS = 8;

    /** Thrown when a chat request runs past {@link #AGENT_DEADLINE}; nothing is saved. */
    public static final class AgentDeadlineException extends IllegalStateException {
        public AgentDeadlineException() {
            super("The assistant ran out of time for this request (" + AGENT_DEADLINE.toSeconds()
                    + "s). Nothing was saved; try a narrower request.");
        }
    }

    private final AssistantProperties properties;
    private final ProfileCredentialStore credentials;
    private final OpenAiAgent openAi;
    private final AnthropicAgent anthropic;

    public AssistantAgent(
            AssistantProperties properties,
            ProfileCredentialStore credentials,
            OpenAiAgent openAi,
            AnthropicAgent anthropic) {
        this.properties = properties;
        this.credentials = credentials;
        this.openAi = openAi;
        this.anthropic = anthropic;
    }

    /** The provider this profile chose, or the configured default when it never chose one. */
    public AssistantProvider provider() {
        return credentials.loadProvider().orElseGet(this::defaultProvider);
    }

    /** ASSISTANT_PROVIDER, or OpenAI when it is unset or not a known provider. */
    private AssistantProvider defaultProvider() {
        try {
            return AssistantProvider.fromId(properties.getProvider());
        } catch (IllegalArgumentException unknown) {
            return AssistantProvider.OPENAI;
        }
    }

    /** True when the active provider has a key, so chat can run. */
    public boolean configured() {
        return configured(provider());
    }

    public boolean configured(AssistantProvider provider) {
        return apiKey(provider) != null;
    }

    public boolean profileKeyConfigured(AssistantProvider provider) {
        return credentials.hasKey(provider);
    }

    public String model(AssistantProvider provider) {
        return provider == AssistantProvider.ANTHROPIC ? anthropic.model() : openAi.model();
    }

    /** Settings shown to the UI. Never contains a key. */
    public Map<String, Object> settings() {
        AssistantProvider active = provider();
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("provider", active.id());
        settings.put("assistantConfigured", configured(active));
        settings.put("openAiConfigured", configured(AssistantProvider.OPENAI));
        settings.put("profileApiKey", profileKeyConfigured(AssistantProvider.OPENAI));
        settings.put("anthropicConfigured", configured(AssistantProvider.ANTHROPIC));
        settings.put("profileAnthropicKey", profileKeyConfigured(AssistantProvider.ANTHROPIC));
        settings.put("models", Map.of(
                AssistantProvider.OPENAI.id(), model(AssistantProvider.OPENAI),
                AssistantProvider.ANTHROPIC.id(), model(AssistantProvider.ANTHROPIC)));
        return settings;
    }

    public String reply(Conversation conversation) throws IOException {
        AssistantProvider provider = provider();
        String key = apiKey(provider);
        if (key == null) throw new IllegalStateException(missingKeyMessage(provider));
        long deadline = System.nanoTime() + AGENT_DEADLINE.toNanos();
        return provider == AssistantProvider.ANTHROPIC
                ? anthropic.reply(conversation, key, deadline)
                : openAi.reply(conversation, key, deadline);
    }

    public static String missingKeyMessage(AssistantProvider provider) {
        return provider == AssistantProvider.ANTHROPIC
                ? "ANTHROPIC_API_KEY is not configured. Add an Anthropic key in Settings."
                : "OPENAI_API_KEY is not configured. Add an OpenAI key in Settings.";
    }

    private String apiKey(AssistantProvider provider) {
        return credentials.loadKey(provider).orElseGet(() -> {
            if (!ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId())) return null;
            String fallback = provider == AssistantProvider.ANTHROPIC
                    ? properties.getAnthropicApiKey()
                    : properties.getOpenaiApiKey();
            return fallback == null || fallback.isBlank() ? null : fallback.trim();
        });
    }
}
