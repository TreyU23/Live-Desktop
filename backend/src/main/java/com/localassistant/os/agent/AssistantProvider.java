package com.localassistant.os.agent;

import java.util.Locale;

/** The model providers a profile can send assistant requests to. */
public enum AssistantProvider {
    OPENAI("openai", "OpenAI"),
    ANTHROPIC("anthropic", "Anthropic");

    private final String id;
    private final String displayName;

    AssistantProvider(String id, String displayName) {
        this.id = id;
        this.displayName = displayName;
    }

    public String id() {
        return id;
    }

    public String displayName() {
        return displayName;
    }

    /** Parses a provider id ("openai" or "anthropic"); anything else is rejected. */
    public static AssistantProvider fromId(String value) {
        String cleaned = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        for (AssistantProvider provider : values()) {
            if (provider.id.equals(cleaned)) return provider;
        }
        throw new IllegalArgumentException("Choose openai or anthropic as the assistant provider.");
    }
}
