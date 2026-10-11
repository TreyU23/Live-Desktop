package com.localassistant.os.agent;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.openai.client.OpenAIClient;
import org.junit.jupiter.api.Test;

class ProfileClientPoolTest {
    @Test void rotationAndShutdownCloseClientsAfterActiveLeasesFinish() {
        var first = mock(OpenAIClient.class); var second = mock(OpenAIClient.class);
        var pool = new ProfileClientPool(key -> key.equals("one") ? first : second);
        var a = pool.acquire("profile", "one"); var b = pool.acquire("profile", "one");
        assertThat(a.client()).isSameAs(b.client());
        var rotated = pool.acquire("profile", "two");
        verify(first, never()).close(); a.close(); verify(first, never()).close();
        b.close(); verify(first).close(); pool.close(); verify(second, never()).close();
        rotated.close(); verify(second).close();
        assertThatThrownBy(() -> pool.acquire("profile", "one")).isInstanceOf(IllegalStateException.class);
    }
    @Test void evictionIsBoundedAndProfilesNeverShareClients() {
        var clients = new java.util.ArrayList<OpenAIClient>();
        var pool = new ProfileClientPool(key -> { var client = mock(OpenAIClient.class); clients.add(client); return client; });
        for (int i = 0; i < 17; i++) { try (var lease = pool.acquire("profile" + i, "same-key")) { assertThat(lease.client()).isSameAs(clients.get(i)); } }
        verify(clients.getFirst()).close(); pool.close();
        for (var client : clients) verify(client).close();
    }
}
