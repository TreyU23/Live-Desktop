package com.localassistant.os.service;

import com.localassistant.os.profile.ProfilePaths;
import com.localassistant.os.store.StateStore;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import org.springframework.stereotype.Service;

@Service
public class ProfileDataService {
    private final ProfilePaths paths;
    private final StateStore state;
    private final ICloudCalendarService calendar;
    private final ProfileCredentialStore profileCredentials;

    public ProfileDataService(
            ProfilePaths paths,
            StateStore state,
            ICloudCalendarService calendar,
            ProfileCredentialStore profileCredentials) {
        this.paths = paths;
        this.state = state;
        this.calendar = calendar;
        this.profileCredentials = profileCredentials;
    }

    public void deleteCurrent() throws IOException {
        if (paths.currentIsDefault()) throw new IllegalArgumentException("The original local profile cannot be deleted.");
        Path target = paths.currentDirectory().toAbsolutePath().normalize();
        Path profilesRoot = target.getParent();
        if (profilesRoot == null || !target.startsWith(profilesRoot) || target.equals(profilesRoot)) {
            throw new IllegalStateException("Profile data path is invalid.");
        }
        state.clearCurrentCache();
        calendar.clearCurrentCache();
        profileCredentials.clearCurrentCache();
        if (Files.notExists(target)) return;
        try (var files = Files.walk(target)) {
            for (Path path : files.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
