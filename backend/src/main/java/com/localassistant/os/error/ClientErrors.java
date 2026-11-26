package com.localassistant.os.error;

import com.localassistant.os.agent.OpenAiAgent;
import com.localassistant.os.profile.ProfileLifecycle;
import com.openai.errors.OpenAIIoException;
import com.openai.errors.OpenAIRetryableException;
import com.openai.errors.OpenAIServiceException;
import com.openai.errors.PermissionDeniedException;
import com.openai.errors.RateLimitException;
import com.openai.errors.UnauthorizedException;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Turns exceptions into what the UI and the model are allowed to see (issue #19).
 *
 * <p>Only messages Live Desktop wrote itself pass through: a plain IllegalArgumentException,
 * IllegalStateException or IOException (or one of our own subclasses) thrown from a
 * {@code com.localassistant} frame. Those are the curated validation and status messages. Anything
 * else (JDK file-system errors that name paths, OpenAI SDK errors that echo the request or key,
 * parser and network errors) becomes a stable code and a generic message, and the detail goes to
 * the backend log under a short reference the user can quote.
 */
public final class ClientErrors {
    private static final Logger kLog = LoggerFactory.getLogger(ClientErrors.class);
    private static final String kOwnPackage = "com.localassistant.";
    private static final int kMaxMessageLength = 500;

    public record ClientError(String code, String message) {
        public Map<String, String> body() {
            return Map.of("error", message, "code", code);
        }
    }

    private ClientErrors() {}

    public static ClientError describe(Throwable error) {
        if (error instanceof OpenAiAgent.AgentDeadlineException) return new ClientError("deadline_exceeded", error.getMessage());
        if (error instanceof ProfileLifecycle.ProfileDeletedException) return new ClientError("profile_deleted", error.getMessage());
        if (error instanceof UnauthorizedException) {
            return logged("openai_unauthorized", "OpenAI rejected the API key. Check it in Settings.", error);
        }
        if (error instanceof PermissionDeniedException) {
            return logged("openai_forbidden", "OpenAI refused this request for the configured key.", error);
        }
        if (error instanceof RateLimitException) {
            return logged("openai_rate_limited", "OpenAI's rate limit was reached. Try again shortly.", error);
        }
        if (error instanceof OpenAIServiceException service) {
            return logged("openai_error", "OpenAI returned an error (HTTP " + service.statusCode() + ").", error);
        }
        if (error instanceof OpenAIIoException || error instanceof OpenAIRetryableException) {
            return logged("openai_unreachable", "Live Desktop couldn't reach OpenAI.", error);
        }
        if (authoredHere(error)) {
            String code = error instanceof IllegalArgumentException ? "invalid_request"
                    : error instanceof IOException ? "io_error" : "unavailable";
            return new ClientError(code, truncate(error.getMessage()));
        }
        return logged("internal_error", null, error);
    }

    public static Map<String, String> body(Throwable error) {
        return describe(error).body();
    }

    public static String message(Throwable error) {
        return describe(error).message();
    }

    static boolean authoredHere(Throwable error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return false;
        Class<?> type = error.getClass();
        boolean curatedType = type == IllegalArgumentException.class || type == IllegalStateException.class
                || type == IOException.class || type.getName().startsWith(kOwnPackage);
        if (!curatedType) return false;
        StackTraceElement[] stack = error.getStackTrace();
        return stack.length > 0 && stack[0].getClassName().startsWith(kOwnPackage);
    }

    private static ClientError logged(String code, String message, Throwable error) {
        String reference = UUID.randomUUID().toString().substring(0, 8);
        kLog.warn("Request failed [{}] ({})", reference, code, error);
        String shown = message == null
                ? "Something went wrong. Details are in the Live Desktop log (ref " + reference + ")."
                : message + " (ref " + reference + ")";
        return new ClientError(code, shown);
    }

    private static String truncate(String message) {
        return message.length() <= kMaxMessageLength ? message : message.substring(0, kMaxMessageLength) + "...";
    }
}
