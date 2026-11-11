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
mvn dependency:copy "-Dartifact=com.localassistant:live-desktop-windows-x64:1.1.0:zip" "-DremoteRepositories=github::default::https://maven.pkg.github.com/treyu23/live-desktop" "-DoutputDirectory=downloads"
```

Replace the example version with the intended release. Check Actions for checksum, authentication or duplicate-version failures. [Validation scope](VALIDATION.md).
