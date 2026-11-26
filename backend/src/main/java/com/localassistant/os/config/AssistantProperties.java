package com.localassistant.os.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "assistant")
public class AssistantProperties {
    private String dataDir = "../data";
    private String workspaceRoot = "..";
    private String openaiApiKey = "";
    private String openaiModel = "gpt-6.2-sol";
    private String reasoningEffort = "medium";
    private String anthropicApiKey = "";
    private String anthropicModel = "claude-sonnet-5-5";
    private String anthropicEffort = "medium";
    private String provider = "openai";

    public String getDataDir() {
        String installation = System.getenv("LIVE_DESKTOP_ROOT");
        java.nio.file.Path configured = java.nio.file.Path.of(dataDir);
        return installation != null && !installation.isBlank() && !configured.isAbsolute()
                ? java.nio.file.Path.of(installation).resolve("backend").resolve(configured).normalize().toString()
                : dataDir;
    }

    public void setDataDir(String dataDir) {
        this.dataDir = dataDir;
    }

    public String getWorkspaceRoot() {
        return workspaceRoot;
    }

    public void setWorkspaceRoot(String workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }

    public String getOpenaiApiKey() {
        return openaiApiKey;
    }

    public void setOpenaiApiKey(String openaiApiKey) {
        this.openaiApiKey = openaiApiKey;
    }

    public String getOpenaiModel() {
        return openaiModel;
    }

    public void setOpenaiModel(String openaiModel) {
        this.openaiModel = openaiModel;
    }

    public String getReasoningEffort() {
        return reasoningEffort;
    }

    public void setReasoningEffort(String reasoningEffort) {
        this.reasoningEffort = reasoningEffort;
    }

    public String getAnthropicApiKey() {
        return anthropicApiKey;
    }

    public void setAnthropicApiKey(String anthropicApiKey) {
        this.anthropicApiKey = anthropicApiKey;
    }

    public String getAnthropicModel() {
        return anthropicModel;
    }

    public void setAnthropicModel(String anthropicModel) {
        this.anthropicModel = anthropicModel;
    }

    public String getAnthropicEffort() {
        return anthropicEffort;
    }

    public void setAnthropicEffort(String anthropicEffort) {
        this.anthropicEffort = anthropicEffort;
    }

    /** Default provider for profiles that never chose one in Settings: openai or anthropic. */
    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }
}
