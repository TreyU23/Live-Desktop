# Windows runtime distribution

Download the ZIP/checksum from [GitHub Releases](https://github.com/TreyU23/Live-Desktop/releases/latest), extract the whole folder and follow its `INSTALL.md` or the [root README](../README.md). Java-inclusive packages need Windows 10/11 x64 and no build tools.

## Build and verify

```powershell
.\scripts\build-production.ps1
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
.\scripts\test-production-startup.ps1 -PackagePath .\dist\Live-Desktop-windows-x64.zip
$releaseHash = (Get-FileHash .\dist\Live-Desktop-windows-x64.zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$releaseHash  Live-Desktop-windows-x64.zip" | Set-Content .\dist\Live-Desktop-windows-x64.zip.sha256 -Encoding ascii
```

Omit `-IncludeJavaRuntime` only when recipients already have Java 21. The ZIP contains four native binaries, extracted backend JAR/libraries/CDS, client assets, documentation, bootstrap script, `.env.example` and a SHA-256 manifest. It excludes saved data, credentials, `.env`, logs and dependency caches. Source rebuild commands require a full checkout. `-SkipBuild` reuses artifacts and runs no tests.

## Publish and download through Maven

`.github/workflows/publish-runtime-package.yml` runs on release publication or manual dispatch with an existing stable `vMAJOR.MINOR.PATCH` tag. Attach the ZIP and `.sha256` first. The job checks the downloaded release checksum and publishes the same bytes using repository `GITHUB_TOKEN` (`contents: read`, `packages: write`). It performs no build/tests. Treat package versions as immutable.

Coordinates: `com.localassistant:live-desktop-windows-x64:<version>:zip`, registry `https://maven.pkg.github.com/treyu23/live-desktop`. This is an application distribution, not a Java library. Registry downloads require authentication; ordinary release downloads need no Maven credentials.

Configure private Maven `settings.xml` with server ID `github` and a classic GitHub token with `read:packages`, following [GitHub's registry instructions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry). Never commit credentials. For example, with a published version:

```powershell
mvn dependency:copy "-Dartifact=com.localassistant:live-desktop-windows-x64:3.1.2:zip" "-DremoteRepositories=github::default::https://maven.pkg.github.com/treyu23/live-desktop" "-DoutputDirectory=downloads"
```

Replace the example version with the intended release. Check Actions for checksum, authentication or duplicate-version failures. [Validation scope](VALIDATION.md).

## Verify a download

The `.sha256` asset only detects a damaged download: anyone who can change the release can change both files. From 3.0.3 the ZIP's SHA-256 is also written into the annotated release tag (`Live-Desktop-windows-x64.zip SHA-256: <hash>`), and the tag is SSH-signed on the release PC with the maintainer's registered signing key. To check a download against it:

```powershell
.\scripts\verify-release.ps1 -Zip .\Live-Desktop-windows-x64.zip -Tag v3.1.2
```

The script requires GitHub to report the tag signature as verified and the hash in the tag to match the file. With a clone and the maintainer's public key in an allowed-signers file, `git tag -v v3.0.3` checks the same signature without trusting GitHub's verification. The publish workflow runs the same tag check before it publishes the Maven package, and its `actions/setup-java` step is pinned to a commit SHA.

The native binaries (launcher, page host, bridge, credentials DLL) are not Authenticode-signed, so Windows SmartScreen may warn on first run. Signing them needs a code-signing certificate, which the project does not have yet.
