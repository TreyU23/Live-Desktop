package com.localassistant.os.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ProfileCredentialStore {
    private final ObjectMapper mapper = new ObjectMapper();
    private final ProfilePaths profilePaths;
    private final com.localassistant.os.agent.ProfileClientPool clients;
    private final Map<String, Optional<String>> cachedKeys = new HashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public ProfileCredentialStore(ProfilePaths profilePaths, com.localassistant.os.agent.ProfileClientPool clients) { this.profilePaths = profilePaths; this.clients = clients; }
    public ProfileCredentialStore(ProfilePaths profilePaths) { this(profilePaths, null); }

    public synchronized void saveOpenAiKey(String apiKey) throws IOException {
        String cleaned = apiKey == null ? "" : apiKey.trim();
        if (!cleaned.startsWith("sk-") || cleaned.length() < 20) {
            throw new IllegalArgumentException("Enter a valid OpenAI API key.");
        }
        Path file = profilePaths.file("openai-credentials.json");
        Files.createDirectories(file.getParent());
        mapper.writeValue(file.toFile(), Map.of("protectedApiKey", protect(cleaned)));
        cachedKeys.put(ProfileContext.currentId(), Optional.of(cleaned));
        if (clients != null) clients.invalidate(ProfileContext.currentId());
    }

    public synchronized Optional<String> loadOpenAiKey() {
        String profileId = ProfileContext.currentId();
        if (cachedKeys.containsKey(profileId)) return cachedKeys.get(profileId);
        Optional<String> loaded = protectedOpenAiKey().flatMap(encrypted -> {
            try {
                return Optional.of(unprotect(encrypted));
            } catch (Exception ignored) {
                return Optional.empty();
            }
        });
        cachedKeys.put(profileId, loaded);
        return loaded;
    }

    public synchronized boolean hasOpenAiKey() {
        return loadOpenAiKey().isPresent();
    }

    private Optional<String> protectedOpenAiKey() {
        Path file = profilePaths.file("openai-credentials.json");
        if (Files.notExists(file)) return Optional.empty();
        try {
            @SuppressWarnings("unchecked") Map<String, String> saved = mapper.readValue(file.toFile(), Map.class);
            String encrypted = saved.getOrDefault("protectedApiKey", "").trim();
            return encrypted.isBlank() ? Optional.empty() : Optional.of(encrypted);
        } catch (Exception ignored) { return Optional.empty(); }
    }

    public synchronized void clearOpenAiKey() throws IOException {
        Files.deleteIfExists(profilePaths.file("openai-credentials.json"));
        cachedKeys.remove(ProfileContext.currentId());
        if (clients != null) clients.invalidate(ProfileContext.currentId());
    }

    public synchronized void clearCurrentCache() { cachedKeys.remove(ProfileContext.currentId()); if (clients != null) clients.invalidate(ProfileContext.currentId()); }

    private String protect(String value) throws IOException {
        return WindowsCredentialProtection.protect(profilePaths.workspaceRoot(), value);
    }

    private String unprotect(String value) throws IOException {
        return WindowsCredentialProtection.unprotect(profilePaths.workspaceRoot(), value);
    }

}
