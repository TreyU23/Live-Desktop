package com.localassistant.os.profile;

import com.localassistant.os.config.AssistantProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

@Component
public class ProfilePaths {
    /** Profile folders that may exist at once; a well-formed but made-up id can't add one past this (issue #18). */
    public static final int MAX_PROFILES = 64;

    private final Path dataRoot;
    private final Path workspaceRoot;
    private final Path installRoot;

    public ProfilePaths(AssistantProperties properties) {
        dataRoot = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        workspaceRoot = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        installRoot = properties.installRoot();
    }

    public Path file(String fileName) {
        if (ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId())) return dataRoot.resolve(fileName);
        return dataRoot.resolve("profiles").resolve(ProfileContext.currentId()).resolve(fileName);
    }

    public Path currentDirectory() {
        if (ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId())) return dataRoot;
        return dataRoot.resolve("profiles").resolve(ProfileContext.currentId()).normalize();
    }

    /**
     * The known-profile set is the profile folders on disk: a profile exists once something has been
     * saved for it. Reads for a profile with no folder see empty data and leave nothing behind.
     */
    public boolean currentExists() {
        return currentIsDefault() || Files.isDirectory(currentDirectory());
    }

    /** Creates the current profile's folder on its first write, refusing a new one past {@link #MAX_PROFILES}. */
    public synchronized Path prepareCurrentDirectory() throws IOException {
        Path directory = currentDirectory();
        if (!currentIsDefault() && !Files.isDirectory(directory)) {
            Path profiles = dataRoot.resolve("profiles");
            long existing = 0;
            if (Files.isDirectory(profiles)) {
                try (var children = Files.list(profiles)) {
                    // Only folders the UI could select count; stray folders with other names never block a new profile.
                    existing = children.filter(Files::isDirectory)
                            .filter(child -> ProfileContext.parse(child.getFileName().toString())
                                    .filter(id -> !ProfileContext.DEFAULT_PROFILE.equals(id)).isPresent())
                            .count();
                }
            }
            if (existing >= MAX_PROFILES) {
                throw new IllegalStateException("Live Desktop keeps at most " + MAX_PROFILES
                        + " profiles. Delete one in Settings before adding another.");
            }
        }
        Files.createDirectories(directory);
        return directory;
    }

    public boolean currentIsDefault() { return ProfileContext.DEFAULT_PROFILE.equals(ProfileContext.currentId()); }
    public Path workspaceRoot() { return workspaceRoot; }
    /** Live Desktop's own folder; native binaries load from here, never from the workspace. */
    public Path installRoot() { return installRoot; }
}
