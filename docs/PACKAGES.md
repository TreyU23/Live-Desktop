# Windows runtime distribution

The GitHub release is the normal installation path. Download `Live-Desktop-windows-x64.zip` and its `.sha256` file from the release, extract the complete folder, and follow `INSTALL.md`. The Java-inclusive release ZIP needs Windows 10/11 x64 and no development tools.

The same ZIP is published in GitHub Packages using Maven coordinates:

```text
com.localassistant:live-desktop-windows-x64:0.2.0:zip
https://maven.pkg.github.com/treyu23/live-desktop
```

This is a distribution archive containing native executables, the Java deployment, frontend assets and bundled Java runtime. It is not a Java library dependency. A Maven client can download it, but Maven is not required to run the extracted application.

GitHub requires authentication even when downloading public Maven packages. Use a GitHub personal access token (classic) with `read:packages` in your private Maven `settings.xml`, as described in [GitHub's Maven registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry). Match the settings server ID to `github`. Do not commit the token or settings file. With that server configured:

```powershell
mvn dependency:copy "-Dartifact=com.localassistant:live-desktop-windows-x64:0.2.0:zip" "-DremoteRepositories=github::default::https://maven.pkg.github.com/treyu23/live-desktop" "-DoutputDirectory=downloads"
```

Replace `0.2.0` with the desired release version. Downloads through the ordinary GitHub release page do not require Maven registry credentials.

## Publication

`.github/workflows/publish-runtime-package.yml` runs when a release is published. Maintainers can also run **Publish Windows runtime package** from the Actions page and enter an existing stable release tag. It downloads the release ZIP and checksum, checks their integrity, and publishes the same bytes to the registry with the tag's version. The job uses the repository-scoped `GITHUB_TOKEN` with `contents: read` and `packages: write`; no personal token is stored in the repository. It runs no application tests and performs no runtime build. Attach both files before publishing the release.

Build the runtime with the documented production build first. To package existing build artifacts without another build or test run:

```powershell
.\scripts\package-production.ps1 -SkipBuild -IncludeJavaRuntime
$releaseHash = (Get-FileHash .\dist\Live-Desktop-windows-x64.zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$releaseHash  Live-Desktop-windows-x64.zip" | Set-Content .\dist\Live-Desktop-windows-x64.zip.sha256 -Encoding ascii
```

The publisher refuses tags that are not `vMAJOR.MINOR.PATCH`. Already-published package versions should be treated as immutable; create a new release version for changed bytes. Inspect the Actions run for asset download, checksum, authentication or duplicate-version failures. See the root README for upgrades, backup, startup and lifecycle commands.
