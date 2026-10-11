package com.localassistant.os.service;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PhoneMetadataCacheTest {
    @TempDir Path directory;
    @Test void replacementAndPartialFilesDoNotReuseInvalidData() throws Exception {
        Path file = directory.resolve("phone.json"); var cache = new PhoneMetadataCache();
        Files.writeString(file, "{\"battery\":\"20%\"}");
        assertThat(cache.read(file, false).path("battery").asText()).isEqualTo("20%");
        Files.writeString(file, "{\"battery\":\"100%\"}");
        assertThat(cache.read(file, false).path("battery").asText()).isEqualTo("100%");
        Files.writeString(file, "{partial"); assertThat(cache.read(file, true).isEmpty()).isTrue();
        Files.delete(file); assertThat(cache.read(file, false).isEmpty()).isTrue();
    }
    @Test void oversizedMetadataIsRejected() throws Exception {
        Path file = directory.resolve("large.json"); Files.writeString(file, "x".repeat(1024 * 1024 + 1));
        assertThat(new PhoneMetadataCache().read(file, false).isEmpty()).isTrue();
    }
}
