package com.localassistant.os.profile;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

public final class ProfileContext {
    public static final String DEFAULT_PROFILE = "default";
    /**
     * Every other profile id is made by the UI as crypto.randomUUID() with '_' in place of '-'
     * (ProfileMenu.createProfile). Ids become folder names and map keys, so nothing else is accepted
     * (issue #18). Lowercased so one Windows folder can't be reached under two cache keys.
     */
    private static final Pattern PROFILE_ID = Pattern.compile("[0-9a-f]{8}(?:_[0-9a-f]{4}){3}_[0-9a-f]{12}");
    private static final ThreadLocal<String> CURRENT = ThreadLocal.withInitial(() -> DEFAULT_PROFILE);

    private ProfileContext() {}

    public static String currentId() {
        return CURRENT.get();
    }

    /** The canonical id for a requested profile, or empty when it isn't a profile id. Blank means the default profile. */
    public static Optional<String> parse(String requestedId) {
        if (requestedId == null || requestedId.isBlank()) return Optional.of(DEFAULT_PROFILE);
        String value = requestedId.trim().toLowerCase(Locale.ROOT);
        return DEFAULT_PROFILE.equals(value) || PROFILE_ID.matcher(value).matches() ? Optional.of(value) : Optional.empty();
    }

    public static void set(String requestedId) {
        CURRENT.set(parse(requestedId).orElseThrow(() -> new IllegalArgumentException("Not a valid profile id.")));
    }

    public static void clear() {
        CURRENT.remove();
    }
}
