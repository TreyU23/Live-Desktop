package com.localassistant.os.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;

/** DPAPI inside the JVM: plaintext credentials never enter the bridge pipe. */
final class WindowsCredentialProtection {
    private static boolean loaded;

    private static synchronized void load(Path workspace) throws IOException {
        if (loaded) return;
        Path library = workspace.toAbsolutePath().normalize().resolve("native/build/Release/live-desktop-credentials.dll");
        if (!Files.isRegularFile(library)) throw new IOException("Build the native Windows components before saving credentials.");
        try { System.load(library.toString()); loaded = true; }
        catch (UnsatisfiedLinkError error) { throw new IOException("Windows credential library could not load; build matching x64 native components.", error); }
    }

    static String protect(Path workspace, String value) throws IOException {
        load(workspace);
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);
        try { return Base64.getEncoder().encodeToString(crypt(plaintext, true)); }
        finally { Arrays.fill(plaintext, (byte) 0); }
    }

    static String unprotect(Path workspace, String value) throws IOException {
        load(workspace);
        byte[] encrypted;
        try { encrypted = Base64.getDecoder().decode(value); }
        catch (IllegalArgumentException error) { throw new IOException("Invalid protected credential encoding."); }
        byte[] plaintext = crypt(encrypted, false);
        try { return new String(plaintext, StandardCharsets.UTF_8); }
        finally { Arrays.fill(plaintext, (byte) 0); }
    }

    private static native byte[] crypt(byte[] input, boolean protect) throws IOException;
}
