package com.localassistant.os.service;

import com.localassistant.os.config.AssistantProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.LinkOption;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceService {
    private static final Set<String> IGNORED_DIRECTORIES =
            Set.of(".git", ".tools", "node_modules", "dist", "target");
    private final Path root;
    private final Path dataRoot;

    public WorkspaceService(AssistantProperties properties) {
        this.root = Path.of(properties.getWorkspaceRoot()).toAbsolutePath().normalize();
        this.dataRoot = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
    }

    public Path root() {
        return root;
    }

    public Path resolveSafePath(String candidate) throws IOException {
        String requested = candidate == null || candidate.isBlank() ? "." : candidate;
        Path absolute = root.resolve(requested).normalize();
        if (!absolute.startsWith(root)) {
            throw new IllegalArgumentException("Path is outside the configured workspace.");
        }

        Path cursor = root;
        Path realRoot = root.toRealPath();
        for (Path segment : root.relativize(absolute)) {
            cursor = cursor.resolve(segment);
            if (Files.isSymbolicLink(cursor)) {
                throw new IllegalArgumentException("Symbolic links are not allowed in workspace actions.");
            }
            if (Files.exists(cursor, LinkOption.NOFOLLOW_LINKS) && !cursor.toRealPath().startsWith(realRoot)) {
                throw new IllegalArgumentException("Path resolves outside the configured workspace.");
            }
            if (Files.notExists(cursor, LinkOption.NOFOLLOW_LINKS)) {
                break;
            }
        }
        return absolute;
    }

    public FileContents readTextFile(String candidate) throws IOException {
        Path path = resolveSafePath(candidate);
        requireReadable(path);
        if (!Files.isRegularFile(path)) {
            throw new IllegalArgumentException("Requested path is not a file.");
        }
        if (Files.size(path) > 100_000) {
            throw new IllegalArgumentException("File is larger than the 100 KB read limit.");
        }
        return new FileContents(root.relativize(path).toString(), Files.readString(path, StandardCharsets.UTF_8));
    }

    public List<String> listFiles(String subdirectory, int requestedLimit) throws IOException {
        Path start = resolveSafePath(subdirectory);
        requireReadable(start);
        if (!Files.isDirectory(start)) {
            throw new IllegalArgumentException("Requested path is not a directory.");
        }
        int limit = Math.max(1, Math.min(requestedLimit, 500));
        var results = new ArrayList<String>();
        Path realRoot = root.toRealPath();

        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path directory, BasicFileAttributes attributes) throws IOException {
                if (protectedReadPath(directory)) return FileVisitResult.SKIP_SUBTREE;
                if (!directory.toRealPath().startsWith(realRoot)) return FileVisitResult.SKIP_SUBTREE;
                if (!directory.equals(start)
                        && IGNORED_DIRECTORIES.contains(directory.getFileName().toString())) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return results.size() >= limit ? FileVisitResult.TERMINATE : FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attributes) throws IOException {
                if (results.size() >= limit) {
                    return FileVisitResult.TERMINATE;
                }
                if (attributes.isRegularFile() && !Files.isSymbolicLink(file) && file.toRealPath().startsWith(realRoot) && !protectedReadPath(file)) {
                    results.add(root.relativize(file).toString());
                }
                return FileVisitResult.CONTINUE;
            }
        });
        results.sort(Comparator.naturalOrder());
        return results;
    }

    private void requireReadable(Path path) throws IOException {
        if (protectedReadPath(path)) throw new IllegalArgumentException("Local environment and profile data are not available to workspace read tools.");
    }

    private boolean protectedReadPath(Path path) throws IOException {
        Path real = canonicalIfPresent(path);
        Path conventionalData = root.resolve("data");
        if (path.startsWith(dataRoot) || path.startsWith(conventionalData)
                || real.startsWith(canonicalIfPresent(dataRoot)) || real.startsWith(canonicalIfPresent(conventionalData))) return true;
        return environmentFile(path, root) || environmentFile(real, canonicalIfPresent(root));
    }

    private static Path canonicalIfPresent(Path path) throws IOException {
        return Files.exists(path, LinkOption.NOFOLLOW_LINKS) ? path.toRealPath() : path;
    }

    private static boolean environmentFile(Path path, Path workspace) {
        if (!workspace.equals(path.getParent())) return false;
        String name = path.getFileName().toString().toLowerCase(java.util.Locale.ROOT);
        return (name.equals(".env") || name.startsWith(".env.")) && !name.equals(".env.example");
    }

    public record FileContents(String path, String content) {}
}
