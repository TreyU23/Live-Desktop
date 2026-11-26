package com.localassistant.os.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public record AssistantAction(
        String id,
        String kind,
        String status,
        Map<String, Object> arguments,
        String reason,
        Object result,
        String error,
        String createdAt,
        String updatedAt) {

    private static final Set<String> FINISHED = Set.of("completed", "failed", "rejected");

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    /**
     * A finished file write no longer needs its content (up to 500 KB). The state file keeps only the path, the
     * SHA-256 that approvals are matched on, and the size, so history cannot grow without bound.
     */
    public AssistantAction compacted() {
        if (!"workspace_write_file".equals(kind) || !FINISHED.contains(status)
                || arguments == null || !(arguments.get("content") instanceof String content)) {
            return this;
        }
        Map<String, Object> trimmed = new LinkedHashMap<>();
        trimmed.put("path", arguments.get("path"));
        trimmed.put("contentSha256", sha256(content));
        trimmed.put("contentBytes", content.getBytes(StandardCharsets.UTF_8).length);
        return new AssistantAction(id, kind, status, Map.copyOf(trimmed), reason, result, error, createdAt, updatedAt);
    }
}
