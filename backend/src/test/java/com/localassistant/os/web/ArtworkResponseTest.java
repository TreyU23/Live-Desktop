package com.localassistant.os.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.localassistant.os.service.WindowsMediaSessionService;
import org.junit.jupiter.api.Test;

class ArtworkResponseTest {
    @Test void acceptsRasterSignaturesAndRejectsTruncatedOrImpostorData() {
        assertThat(AssistantController.artworkContentType(bytes(0x89, 'P', 'N', 'G', 13, 10, 26, 10))).isEqualTo("image/png");
        assertThat(AssistantController.artworkContentType(bytes(0xff, 0xd8, 0xff))).isEqualTo("image/jpeg");
        assertThat(AssistantController.artworkContentType(bytes('G', 'I', 'F', '8', '9', 'a'))).isEqualTo("image/gif");
        assertThat(AssistantController.artworkContentType(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'))).isEqualTo("image/webp");
        for (byte[] invalid : new byte[][] { bytes(0x89, 'P', 0, 0, 0, 0, 0, 0), bytes('G', 'I', 0, 0, 0, 0),
                bytes('R', 0, 0, 0, 0, 0, 0, 0, 'W', 0, 0, 0), bytes(0xff, 0xd8), bytes('<', 's', 'v', 'g') }) {
            assertThat(AssistantController.artworkContentType(invalid)).isNull();
        }
    }

    @Test void artworkResponseIsPrivateNosniffAndUnknownVersionsReturnNotFound() {
        var media = mock(WindowsMediaSessionService.class);
        byte[] png = bytes(0x89, 'P', 'N', 'G', 13, 10, 26, 10);
        when(media.artwork("1-2-3")).thenReturn(png);
        var controller = new AssistantController(null, null, null, null, null, null, null, null, media, null, null);
        var response = controller.mediaArtwork("1-2-3");
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getFirst("Content-Type")).isEqualTo("image/png");
        assertThat(response.getHeaders().getFirst("Cache-Control")).isEqualTo("private, max-age=30");
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(controller.mediaArtwork("4-5-6").getStatusCode().value()).isEqualTo(404);
    }

    private static byte[] bytes(int... values) {
        byte[] bytes = new byte[values.length];
        for (int index = 0; index < values.length; index++) bytes[index] = (byte) values[index];
        return bytes;
    }
}
