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
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceService {
    private static final Set<String> IGNORED_DIRECTORIES =
            Set.of(".git", ".tools", "node_modules", "dist", "target");
    /** Live Desktop's own top-level folders. The assistant may read some of them, but never write to them. */
    private static final Set<String> PROTECTED_WRITE_DIRECTORIES = Set.of(
            "data", "native", "backend", "frontend", "scripts",
            ".tools", ".git", ".github", ".mvn");
    /**
     * Plain-text types the assistant may create or overwrite. Everything else is refused, including extensionless
     * files, so types Windows runs or acts on when opened or browsed (.js, .url, .scf, .pif, .msc, .chm, .inf, ...)
     * can't be written.
     */
    private static final Set<String> ALLOWED_WRITE_EXTENSIONS = Set.of(
            "txt", "md", "markdown", "json", "csv", "tsv", "yaml", "yml", "toml", "ics", "log");
    /**
     * Build, CI, container, runtime, editor and coding-agent files that run or steer code on the next build or editor
     * open, wherever they sit in a source checkout. This is a denylist of known names: it cannot name every tool's
     * config file, so the approval sheet remains the final control.
     */
    private static final Set<String> PROTECTED_WRITE_FILE_NAMES = Set.of(
            "pom.xml", "mvnw", "mvnw.cmd", "package.json", "package-lock.json", "npm-shrinkwrap.json",
            "yarn.lock", "pnpm-lock.yaml", "pnpm-workspace.yaml", "build.gradle", "build.gradle.kts",
            "settings.gradle", "settings.gradle.kts", "gradlew", "gradlew.bat", "makefile", "dockerfile",
            "agents.md", "claude.md", "desktop.ini", "autorun.inf",
            // Config in the allowed plain-text types that build, CI, container or runtime tooling executes (#40).
            "compose.yml", "compose.yaml", "pyproject.toml", "cargo.toml", "rust-toolchain.toml", "composer.json",
            "global.json", "deno.json", "deno.jsonc", "bunfig.toml", "netlify.toml", "vercel.json", "wrangler.toml",
            "renovate.json", "serverless.yml", "serverless.yaml", "action.yml", "action.yaml", "appveyor.yml",
            "bitbucket-pipelines.yml", "azure-pipelines.yml", "azure-pipelines.yaml", "cloudbuild.yaml",
            "cloudbuild.yml", "pubspec.yaml", "mkdocs.yml", "launch.json", "tasks.json", "nx.json", "turbo.json",
            "lerna.json", "app.yaml");
    /** Name prefixes of the same kind of config, which come in many variants (`application-prod.yml`, ...). */
    private static final List<String> PROTECTED_WRITE_FILE_PREFIXES = List.of(
            "docker-compose", "tsconfig", "jsconfig", "application", "bootstrap", "skaffold", "devcontainer",
            "azure-pipelines", "buildspec");
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

    /**
     * Resolves a path the assistant wants to write. On top of {@link #resolveSafePath} this refuses Live Desktop's
     * own folders, every file at the workspace root, every dot-file and dot-folder (`.vscode`, `.idea`, `.env`, ...),
     * build, CI, runtime, editor and coding-agent config files by known name or name prefix, and every type outside a
     * small plain-text allowlist. That blocks the common ways an approved write could change code or configuration that
     * runs with the next launch, build or editor open; configuration files of tools not on the list are not recognized,
     * so every write still needs the user's approval.
     */
    public Path resolveWritablePath(String candidate) throws IOException {
        Path absolute = resolveSafePath(candidate);
        Path relative = root.relativize(absolute);
        if (relative.toString().isEmpty()) {
            throw new IllegalArgumentException("Path must name a file inside the workspace.");
        }
        if (relative.getNameCount() == 1) {
            throw new IllegalArgumentException("Files at the workspace root are not available to workspace writes; use a folder such as notes/.");
        }
        int index = 0;
        for (Path segment : relative) {
            String raw = segment.toString();
            if (raw.indexOf(':') >= 0) {
                throw new IllegalArgumentException("Alternate data streams are not allowed in workspace writes.");
            }
            // Windows ignores trailing dots and spaces, so "start.cmd. " names start.cmd.
            String name = raw.replaceAll("[. ]+$", "").toLowerCase(Locale.ROOT);
            if (name.isEmpty() || name.matches(".*~\\d+(\\..*)?")) {
                throw new IllegalArgumentException("Path is not allowed for workspace writes.");
            }
            if (index == 0 && PROTECTED_WRITE_DIRECTORIES.contains(name)) {
                throw new IllegalArgumentException("Live Desktop's own folders are not available to workspace writes.");
            }
            if (name.equals(".git") || name.equals(".env") || name.startsWith(".env.")) {
                throw new IllegalArgumentException("Environment and repository files are not available to workspace writes.");
            }
            if (name.startsWith(".")) {
                throw new IllegalArgumentException("Dot-files and dot-folders are not available to workspace writes.");
            }
            index++;
        }
        String leaf = relative.getFileName().toString().replaceAll("[. ]+$", "").toLowerCase(Locale.ROOT);
        if (PROTECTED_WRITE_FILE_NAMES.contains(leaf)
                || PROTECTED_WRITE_FILE_PREFIXES.stream().anyMatch(leaf::startsWith)
                || leaf.endsWith(".config.json")) {
            throw new IllegalArgumentException("Build, editor and agent files are not available to workspace writes.");
        }
        int dot = leaf.lastIndexOf('.');
        if (dot < 0 || !ALLOWED_WRITE_EXTENSIONS.contains(leaf.substring(dot + 1))) {
            throw new IllegalArgumentException("Workspace writes are limited to plain-text files ("
                    + String.join(", ", ALLOWED_WRITE_EXTENSIONS.stream().sorted().toList()) + ").");
        }
        Path real = canonicalIfPresent(absolute);
        if (real.startsWith(canonicalIfPresent(dataRoot)) || absolute.startsWith(dataRoot)) {
            throw new IllegalArgumentException("Profile data is not available to workspace writes.");
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
