package com.localassistant.os.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.bootstrap.DefaultBootstrapContext;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ClassPathResource;
import org.yaml.snakeyaml.Yaml;

class EnvImportTest {
    @TempDir
    Path root;

    @AfterEach
    void clearProperty() {
        System.clearProperty("LIVE_DESKTOP_ROOT");
    }

    @Test
    void onlyTheInstallRootEnvFileIsImported() throws Exception {
        Object config = new Yaml().load(new ClassPathResource("application.yml").getInputStream());
        String text = String.valueOf(config);
        assertThat(text).contains("import=optional:file:${LIVE_DESKTOP_ROOT:..}/.env[.properties]");
        assertThat(text).doesNotContain("file:../.env");
    }

    @Test
    void rootEnvLoadsFromTheLauncherSuppliedRoot() throws Exception {
        Files.writeString(root.resolve(".env"), "canary.root=loaded\n");
        Files.createDirectories(root.resolve("backend/target"));
        Files.writeString(root.resolve("backend/target/.env"), "canary.hostile=loaded\n");
        System.setProperty("LIVE_DESKTOP_ROOT", root.toString().replace('\\', '/'));
        StandardEnvironment environment = new StandardEnvironment();
        ConfigDataEnvironmentPostProcessor.applyTo(
                environment, new DefaultResourceLoader(), new DefaultBootstrapContext());

        assertThat(environment.getProperty("canary.root")).isEqualTo("loaded");
        assertThat(environment.getProperty("canary.hostile")).isNull();
    }
}
