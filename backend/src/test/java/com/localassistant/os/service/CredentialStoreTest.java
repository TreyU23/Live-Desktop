package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.profile.ProfilePaths;
import java.nio.file.Path;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.api.io.TempDir;

@EnabledOnOs(OS.WINDOWS)
class CredentialStoreTest {
    @TempDir
    Path tempDir;

    @Test
    void protectsAndRestoresICloudPasswordWithWindowsDpapi() throws Exception {
        ICloudCredentialStore store = new ICloudCredentialStore(new ProfilePaths(properties()));

        store.save("person@icloud.com", "abcd-efgh-ijkl-mnop");

        assertThat(store.load()).contains(new ICloudCredentialStore.Credentials(
                "person@icloud.com", "abcd-efgh-ijkl-mnop"));
        assertThat(new ICloudCredentialStore(new ProfilePaths(properties())).load()).contains(
                new ICloudCredentialStore.Credentials("person@icloud.com", "abcd-efgh-ijkl-mnop"));
        assertThat(Files.readString(tempDir.resolve("icloud-calendar-credentials.json"))).doesNotContain("abcd-efgh-ijkl-mnop");
    }

    @Test
    void reportsAndRestoresProfileOpenAiKeyWithoutExposingItInStatusChecks() throws Exception {
        ProfileCredentialStore store = new ProfileCredentialStore(new ProfilePaths(properties()));
        String apiKey = "sk-test-profile-key-1234567890";

        store.saveOpenAiKey(apiKey);

        assertThat(store.hasOpenAiKey()).isTrue();
        assertThat(store.loadOpenAiKey()).contains(apiKey);
        assertThat(new ProfileCredentialStore(new ProfilePaths(properties())).loadOpenAiKey()).contains(apiKey);
        store.clearOpenAiKey();
        assertThat(store.hasOpenAiKey()).isFalse();
        assertThat(store.loadOpenAiKey()).isEmpty();
    }

    @Test void dpapiRoundTripHandlesUnicodeAndRejectsCorruption() throws Exception {
        Path workspace = new ProfilePaths(properties()).workspaceRoot();
        String secret = "test-secret-\u03bb-\u4e2d\u6587";
        String encrypted = WindowsCredentialProtection.protect(workspace, secret);
        assertThat(WindowsCredentialProtection.unprotect(workspace, encrypted)).isEqualTo(secret);
        assertThatThrownBy(() -> WindowsCredentialProtection.unprotect(workspace, "invalid-base64"))
                .isInstanceOf(java.io.IOException.class);
        assertThatThrownBy(() -> WindowsCredentialProtection.unprotect(workspace, "AAAA"))
                .isInstanceOf(java.io.IOException.class);
    }

    @Test void corruptProfileCredentialsAreUnavailableAndReplacementInvalidatesCachedAbsence() throws Exception {
        Files.writeString(tempDir.resolve("openai-credentials.json"), "{\"protectedApiKey\":\"invalid-base64\"}");
        ProfileCredentialStore store = new ProfileCredentialStore(new ProfilePaths(properties()));
        assertThat(store.hasOpenAiKey()).isFalse();
        assertThat(store.loadOpenAiKey()).isEmpty();
        store.saveOpenAiKey("sk-test-replacement-key-1234567890");
        assertThat(store.hasOpenAiKey()).isTrue();
        assertThat(store.loadOpenAiKey()).contains("sk-test-replacement-key-1234567890");
    }

    @Test void readsLegacyDotNetProtectedDataWithoutRewritingUserFiles() throws Exception {
        // Synthetic legacy fixture only. Production code never invokes PowerShell.
        Process process = new ProcessBuilder("powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                "Add-Type -AssemblyName System.Security;$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd());[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))").start();
        String secret = "synthetic-legacy-password";
        process.getOutputStream().write(secret.getBytes(StandardCharsets.UTF_8));
        process.getOutputStream().close();
        if (!process.waitFor(15, TimeUnit.SECONDS)) { process.destroyForcibly(); throw new AssertionError("Legacy fixture timed out."); }
        assertThat(process.exitValue()).isZero();
        String encrypted = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        assertThat(WindowsCredentialProtection.unprotect(new ProfilePaths(properties()).workspaceRoot(), encrypted)).isEqualTo(secret);
    }

    private AssistantProperties properties() {
        AssistantProperties properties = new AssistantProperties();
        properties.setDataDir(tempDir.toString());
        return properties;
    }
}
