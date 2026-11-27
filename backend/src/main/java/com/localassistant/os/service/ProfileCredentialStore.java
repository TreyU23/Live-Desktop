package com.localassistant.os.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.agent.AssistantProvider;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Per-profile model provider keys (protected with Windows data protection) and the profile's
 * chosen provider. Keys never leave this class except to make model requests.
 */
@Component
public class ProfileCredentialStore {
    private static final String kProviderFile = "assistant-provider.json";

    private final ObjectMapper mapper = new ObjectMapper();
    private final ProfilePaths profilePaths;
    private final com.localassistant.os.agent.ProfileClientPool clients;
    private final Map<String, Optional<String>> cachedKeys = new HashMap<>();
    private final Map<String, Optional<AssistantProvider>> cachedProviders = new HashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public ProfileCredentialStore(ProfilePaths profilePaths, com.localassistant.os.agent.ProfileClientPool clients) { this.profilePaths = profilePaths; this.clients = clients; }
    public ProfileCredentialStore(ProfilePaths profilePaths) { this(profilePaths, null); }

    // OpenAI names kept for existing callers.
    public void saveOpenAiKey(String apiKey) throws IOException { saveKey(AssistantProvider.OPENAI, apiKey); }
    public Optional<String> loadOpenAiKey() { return loadKey(AssistantProvider.OPENAI); }
    public boolean hasOpenAiKey() { return hasKey(AssistantProvider.OPENAI); }
    public void clearOpenAiKey() throws IOException { clearKey(AssistantProvider.OPENAI); }

    public synchronized void saveKey(AssistantProvider provider, String apiKey) throws IOException {
        String cleaned = validated(provider, apiKey);
        Path file = profilePaths.file(keyFile(provider));
        profilePaths.prepareCurrentDirectory();
        mapper.writeValue(file.toFile(), Map.of("protectedApiKey", protect(cleaned)));
        cachedKeys.put(cacheKey(provider), Optional.of(cleaned));
        if (provider == AssistantProvider.OPENAI && clients != null) clients.invalidate(ProfileContext.currentId());
    }

    public synchronized Optional<String> loadKey(AssistantProvider provider) {
        String cacheKey = cacheKey(provider);
        if (cachedKeys.containsKey(cacheKey)) return cachedKeys.get(cacheKey);
        Optional<String> loaded = protectedKey(provider).flatMap(encrypted -> {
            try {
                return Optional.of(unprotect(encrypted));
            } catch (Exception ignored) {
                return Optional.empty();
            }
        });
        // Only cache profiles that exist, so lookups for made-up ids leave nothing behind (issue #18).
        if (profilePaths.currentExists()) cachedKeys.put(cacheKey, loaded);
        return loaded;
    }

    public synchronized boolean hasKey(AssistantProvider provider) {
        return loadKey(provider).isPresent();
    }

    public synchronized void clearKey(AssistantProvider provider) throws IOException {
        Files.deleteIfExists(profilePaths.file(keyFile(provider)));
        cachedKeys.remove(cacheKey(provider));
        if (provider == AssistantProvider.OPENAI && clients != null) clients.invalidate(ProfileContext.currentId());
    }

    /** The provider this profile chose in Settings, if it chose one. */
    public synchronized Optional<AssistantProvider> loadProvider() {
        String profileId = ProfileContext.currentId();
        if (cachedProviders.containsKey(profileId)) return cachedProviders.get(profileId);
        Optional<AssistantProvider> loaded = Optional.empty();
        Path file = profilePaths.file(kProviderFile);
        if (Files.exists(file)) {
            try {
                @SuppressWarnings("unchecked") Map<String, String> saved = mapper.readValue(file.toFile(), Map.class);
                loaded = Optional.of(AssistantProvider.fromId(saved.get("provider")));
            } catch (Exception ignored) {
                loaded = Optional.empty();
            }
        }
        if (profilePaths.currentExists()) cachedProviders.put(profileId, loaded);
        return loaded;
    }

    public synchronized void saveProvider(AssistantProvider provider) throws IOException {
        profilePaths.prepareCurrentDirectory();
        mapper.writeValue(profilePaths.file(kProviderFile).toFile(), Map.of("provider", provider.id()));
        cachedProviders.put(ProfileContext.currentId(), Optional.of(provider));
    }

    public synchronized void clearCurrentCache() {
        String profileId = ProfileContext.currentId();
        for (AssistantProvider provider : AssistantProvider.values()) cachedKeys.remove(cacheKey(provider));
        cachedProviders.remove(profileId);
        if (clients != null) clients.invalidate(profileId);
    }

    private static String validated(AssistantProvider provider, String apiKey) {
        String cleaned = apiKey == null ? "" : apiKey.trim();
        if (cleaned.length() > 512 || cleaned.chars().anyMatch(c -> c <= ' ' || c > '~')) {
            throw new IllegalArgumentException("Enter a valid " + provider.displayName() + " API key.");
        }
        if (provider == AssistantProvider.ANTHROPIC) {
            if (!cleaned.startsWith("sk-ant-") || cleaned.length() < 20) {
                throw new IllegalArgumentException("Enter a valid Anthropic API key (it starts with sk-ant-).");
            }
        } else {
            if (cleaned.startsWith("sk-ant-")) {
                throw new IllegalArgumentException("That is an Anthropic key. Save it as the Anthropic API key instead.");
            }
            if (!cleaned.startsWith("sk-") || cleaned.length() < 20) {
                throw new IllegalArgumentException("Enter a valid OpenAI API key.");
            }
        }
        return cleaned;
    }

    private static String keyFile(AssistantProvider provider) {
        return provider == AssistantProvider.ANTHROPIC ? "anthropic-credentials.json" : "openai-credentials.json";
    }

    private static String cacheKey(AssistantProvider provider) {
        return ProfileContext.currentId() + "\u0000" + provider.id();
    }

    private Optional<String> protectedKey(AssistantProvider provider) {
        Path file = profilePaths.file(keyFile(provider));
        if (Files.notExists(file)) return Optional.empty();
        try {
            @SuppressWarnings("unchecked") Map<String, String> saved = mapper.readValue(file.toFile(), Map.class);
            String encrypted = saved.getOrDefault("protectedApiKey", "").trim();
            return encrypted.isBlank() ? Optional.empty() : Optional.of(encrypted);
        } catch (Exception ignored) { return Optional.empty(); }
    }

    private String protect(String value) throws IOException {
        return WindowsCredentialProtection.protect(profilePaths.installRoot(), value);
    }

    private String unprotect(String value) throws IOException {
        return WindowsCredentialProtection.unprotect(profilePaths.installRoot(), value);
    }
}
