package com.localassistant.os.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localassistant.os.profile.ProfileContext;
import com.localassistant.os.profile.ProfilePaths;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class ICloudCredentialStore {
    private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(12);
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
        String script = "Add-Type -AssemblyName System.Security;"
                + "$v=[Console]::In.ReadToEnd();"
                + "$b=[Text.Encoding]::UTF8.GetBytes($v);"
                + "$p=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);"
                + "[Console]::Out.Write([Convert]::ToBase64String($p))";
        return runPowerShell(script, value);
    }

    private String unprotect(String value) throws IOException {
        String script = "Add-Type -AssemblyName System.Security;"
                + "$v=[Console]::In.ReadToEnd();"
                + "$b=[Convert]::FromBase64String($v);"
                + "$p=[System.Security.Cryptography.ProtectedData]::Unprotect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);"
                + "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))";
        return runPowerShell(script, value);
    }

    private String runPowerShell(String script, String input) throws IOException {
        Process process = new ProcessBuilder(
                        "powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script)
                .redirectErrorStream(false)
                .start();
        process.getOutputStream().write(input.getBytes(StandardCharsets.UTF_8));
        process.getOutputStream().close();
        try {
            if (!process.waitFor(COMMAND_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new IOException("Windows credential protection timed out.");
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("Windows credential protection was interrupted.", error);
        }
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        String error = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        if (process.exitValue() != 0 || output.isBlank()) {
            throw new IOException(error.isBlank() ? "Windows credential protection failed." : error);
        }
        return output;
    }

    public record Credentials(String email, String appSpecificPassword) {}
}
