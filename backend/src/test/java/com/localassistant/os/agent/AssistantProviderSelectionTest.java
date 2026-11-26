package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.localassistant.os.config.AssistantProperties;
import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.service.ProfileCredentialStore;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AssistantProviderSelectionTest {
    @TempDir
    Path tempDir;

    @Test
    void defaultsToOpenAiOnTheNewestSolModel() {
        AssistantProperties properties = properties();
        AssistantAgent agent = agent(properties, new ProfileCredentialStore(new ProfilePaths(properties)));

        assertThat(agent.provider()).isEqualTo(AssistantProvider.OPENAI);
        assertThat(properties.getOpenaiModel()).isEqualTo("gpt-6.2-sol");
        assertThat(properties.getAnthropicModel()).isEqualTo("claude-sonnet-5-5");
        assertThat(agent.configured()).isFalse();
    }

    @Test
    void savedProviderChoiceIsPerProfileAndSurvivesRestart() throws Exception {
        AssistantProperties properties = properties();
        new ProfileCredentialStore(new ProfilePaths(properties)).saveProvider(AssistantProvider.ANTHROPIC);

        AssistantAgent restarted = agent(properties, new ProfileCredentialStore(new ProfilePaths(properties)));
        assertThat(restarted.provider()).isEqualTo(AssistantProvider.ANTHROPIC);
        assertThat(restarted.settings()).containsEntry("provider", "anthropic");
        assertThat(Files.readString(tempDir.resolve("assistant-provider.json"))).contains("anthropic");
    }

    @Test
    void environmentDefaultProviderAndKeysApplyToTheOriginalProfileWithoutLeaking() {
        AssistantProperties properties = properties();
        properties.setProvider("anthropic");
        properties.setAnthropicApiKey("sk-ant-env-key-0123456789");
        AssistantAgent agent = agent(properties, new ProfileCredentialStore(new ProfilePaths(properties)));

        assertThat(agent.provider()).isEqualTo(AssistantProvider.ANTHROPIC);
        assertThat(agent.configured()).isTrue();
        assertThat(agent.configured(AssistantProvider.OPENAI)).isFalse();
        assertThat(agent.settings())
                .containsEntry("assistantConfigured", true)
                .containsEntry("profileAnthropicKey", false);
        assertThat(agent.settings().toString()).doesNotContain("sk-ant-env-key");
    }

    @Test
    void unknownEnvironmentProviderFallsBackToOpenAi() {
        AssistantProperties properties = properties();
        properties.setProvider("gemini");
        assertThat(agent(properties, new ProfileCredentialStore(new ProfilePaths(properties))).provider())
                .isEqualTo(AssistantProvider.OPENAI);
    }

    @Test
    void keysAreCheckedAgainstTheirProviderBeforeAnythingIsStored() {
        ProfileCredentialStore store = new ProfileCredentialStore(new ProfilePaths(properties()));

        assertThatThrownBy(() -> store.saveKey(AssistantProvider.OPENAI, "sk-ant-api03-0123456789abcdef"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Anthropic key");
        assertThatThrownBy(() -> store.saveKey(AssistantProvider.ANTHROPIC, "sk-proj-0123456789abcdef"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("sk-ant-");
        assertThatThrownBy(() -> store.saveKey(AssistantProvider.ANTHROPIC, "sk-ant-api03 with spaces 123"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(Files.exists(tempDir.resolve("anthropic-credentials.json"))).isFalse();
        assertThat(Files.exists(tempDir.resolve("openai-credentials.json"))).isFalse();
        assertThatThrownBy(() -> AssistantProvider.fromId("gemini")).isInstanceOf(IllegalArgumentException.class);
    }

    private AssistantAgent agent(AssistantProperties properties, ProfileCredentialStore store) {
        OpenAiAgent openAi = mock(OpenAiAgent.class);
        when(openAi.model()).thenReturn(properties.getOpenaiModel());
        AnthropicAgent anthropic = mock(AnthropicAgent.class);
        when(anthropic.model()).thenReturn(properties.getAnthropicModel());
        return new AssistantAgent(properties, store, openAi, anthropic);
    }

    private AssistantProperties properties() {
        AssistantProperties properties = new AssistantProperties();
        properties.setDataDir(tempDir.toString());
        return properties;
    }
}
