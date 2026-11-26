package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** Issue #11: the native host must wait longer for /api/chat than the backend's agent deadline. */
class ChatTimeoutBudgetTest {
    @Test void nativeHostChatTimeoutOutlastsAgentDeadline() throws Exception {
        Path host = Path.of(System.getProperty("user.dir")).resolve("../native/host/main.cpp").normalize();
        var matcher = Pattern.compile("kChatUpstreamTimeoutMs\\s*=\\s*(\\d+)").matcher(Files.readString(host));
        assertThat(matcher.find()).as("kChatUpstreamTimeoutMs in %s", host).isTrue();
        Duration hostTimeout = Duration.ofMillis(Long.parseLong(matcher.group(1)));
        // Leave headroom for retry backoff and saving the reply after the last model call.
        assertThat(hostTimeout).isGreaterThanOrEqualTo(AssistantAgent.AGENT_DEADLINE.plusSeconds(30));
    }

    @Test void perAttemptTimeoutsFitInsideTheDeadline() {
        assertThat(AssistantAgent.MODEL_CALL_ATTEMPTS).isEqualTo(ProfileClientPool.MAX_RETRIES + 1);
    }
}
