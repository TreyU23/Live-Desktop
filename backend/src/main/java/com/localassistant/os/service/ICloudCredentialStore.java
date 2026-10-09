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
public class ICloudCredentialStore {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ProfilePaths profilePaths;
    private final Map<String, Optional<Credentials>> cachedCredentials = new HashMap<>();

    public ICloudCredentialStore(ProfilePaths profilePaths) {
        this.profilePaths = profilePaths;
    }

    private Path credentialFile() { return profilePaths.file("icloud-calendar-credentials.json"); }

    public synchronized void save(String email, String appSpecificPassword) throws IOException {
        Path credentialFile = credentialFile();
        Files.createDirectories(credentialFile.getParent());
        String protectedPassword = protect(appSpecificPassword);
        objectMapper.writeValue(credentialFile.toFile(), Map.of(
                "email", email.trim(),
                "protectedPassword", protectedPassword));
        cachedCredentials.put(
                ProfileContext.currentId(),
                Optional.of(new Credentials(email.trim(), appSpecificPassword)));
    }

    public synchronized Optional<Credentials> load() {
        String profileId = ProfileContext.currentId();
        if (cachedCredentials.containsKey(profileId)) return cachedCredentials.get(profileId);
        Path credentialFile = credentialFile();
        if (Files.notExists(credentialFile)) {
            cachedCredentials.put(profileId, Optional.empty());
            return Optional.empty();
        }
        Optional<Credentials> loaded;
        try {
            @SuppressWarnings("unchecked")
            Map<String, String> saved = objectMapper.readValue(credentialFile.toFile(), Map.class);
            String email = saved.getOrDefault("email", "").trim();
            String encrypted = saved.getOrDefault("protectedPassword", "").trim();
            loaded = email.isBlank() || encrypted.isBlank()
                    ? Optional.empty()
                    : Optional.of(new Credentials(email, unprotect(encrypted)));
        } catch (Exception ignored) {
            loaded = Optional.empty();
        }
        cachedCredentials.put(profileId, loaded);
        return loaded;
    }

    public synchronized void clear() throws IOException {
        Files.deleteIfExists(credentialFile());
        cachedCredentials.remove(ProfileContext.currentId());
    }

    public synchronized void clearCurrentCache() { cachedCredentials.remove(ProfileContext.currentId()); }

    private String protect(String value) throws IOException {
        return WindowsCredentialProtection.protect(profilePaths.workspaceRoot(), value);
    }

    private String unprotect(String value) throws IOException {
        return WindowsCredentialProtection.unprotect(profilePaths.workspaceRoot(), value);
    }

    public record Credentials(String email, String appSpecificPassword) {}
}
