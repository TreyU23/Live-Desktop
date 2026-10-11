package com.localassistant.os.profile;

import com.localassistant.os.config.AssistantProperties;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class ProfilePaths {
    private final Path dataRoot;
    private final Path workspaceRoot;

    public ProfilePaths(AssistantProperties properties) {
        dataRoot = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
    }

    public Path file(String fileName) {
        if (ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId())) return dataRoot.resolve(fileName);
        return dataRoot.resolve("profiles").resolve(ProfileContext.currentId()).resolve(fileName);
    }

    public Path currentDirectory() {
        if (ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId())) return dataRoot;
        return dataRoot.resolve("profiles").resolve(ProfileContext.currentId()).normalize();
    }

    public boolean currentIsDefault() { return ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId()); }
    public Path workspaceRoot() { return workspaceRoot; }
}
