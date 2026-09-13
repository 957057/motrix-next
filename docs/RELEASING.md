# Releasing Rayburst

This guide covers this repository only. Local development and packaging do not
authorize a release, a store submission or a repository rename. Work on the
current branch. The website is maintained separately and remains Motrix Next.

## Versions and channels

`src-tauri/Cargo.toml` owns the application version. `package.json` must match;
Tauri reads the Cargo version. Use `bash scripts/bump-version.sh <version>` to
update them together. Never edit generated installer versions or use a `v` prefix
inside a manifest. Review the matching package entry in `src-tauri/Cargo.lock`.
The bump script's lockfile sync is best effort, so its success message is not a
compilation check.

Follow [SemVer](https://semver.org/): patches fix behavior without breaking the
public contract, minor versions add compatible functionality, and major versions
change that contract incompatibly. Removing supported protocols, APIs or persisted
formats belongs in the breaking-change assessment. This does not require a
compatibility layer.

| Channel           | Version         | Git tag          | GitHub prerelease | Updater asset |
| ----------------- | --------------- | ---------------- | ----------------- | ------------- |
| Stable            | `X.Y.Z`         | `vX.Y.Z`         | No                | `latest.json` |
| Alpha             | `X.Y.Z-alpha.N` | `vX.Y.Z-alpha.N` | Yes               | `beta.json`   |
| Beta              | `X.Y.Z-beta.N`  | `vX.Y.Z-beta.N`  | Yes               | `beta.json`   |
| Release candidate | `X.Y.Z-rc.N`    | `vX.Y.Z-rc.N`    | Yes               | `beta.json`   |

Use lowercase suffixes and positive counters without leading zeros. Do not invent
other suffixes or build metadata: the release scripts recognize the channels above.
For an authorized release without an explicit target, continue the current channel
and choose the increment from the change. Do not silently promote a prerelease to
stable. Follow an explicit maintainer version or channel request.

The application's **Latest** preference compares the stable and prerelease feeds;
it is not a third feed. Stable and Beta select their respective feeds.

## Prepare and publish

Use the pinned pnpm version and the platform prerequisites in [README](../README.md).
Run shell scripts from the repository root with Bash, including Git Bash on Windows.

1. Finish the changes and inspect the diff, current branch, remotes and local tags.
   Check the chosen tag is unused on the remote. Confirm every bundled engine
   target and the native launcher match the intended release.
2. Run the repository checks in [Contributing](CONTRIBUTING.md), plus `pnpm test`,
   `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`,
   `cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings`
   and `cargo test --manifest-path src-tauri/Cargo.toml --workspace --all-targets`.
   The maintainer performs installation, appearance and integration acceptance.
   Respect task-specific static-only limits and report unperformed checks.
3. Run `bash scripts/bump-version.sh <version>`. Review both manifests and Cargo.lock,
   then check the final source. Prepare release notes from the previous release's
   tag through the proposed release commit.
4. When publication is authorized, run `bash scripts/release.sh`. It formats,
   validates, stages **all** repository changes, creates a release commit if needed,
   creates an annotated `v<version>` tag, then pushes the branch and **all local tags**.
   Inspect that scope first. The script does not create a GitHub Release.
5. Confirm CI passed for the tagged commit. Create and publish the GitHub Release
   using that existing tag, with the prerelease flag matching the table above.
   The Release workflow then builds and attaches the packages.
6. Inspect all target jobs, filenames and signatures, and complete any configured
   Windows signing step before announcing availability. Check the channel JSON
   references the final assets and contains nonempty signatures for every platform.
   The JSON generator does not reject every missing signature itself.

Keep checks and fixtures inside this repository. Manual browser-to-desktop
acceptance uses independently built applications; no parent workspace or
cross-repository test runner is required.

## Packaging and update configuration

[release.yml](../.github/workflows/release.yml) runs on a published GitHub Release
or manual dispatch. A tag push alone does not start packaging. Manual dispatch
builds the selected ref and retains Actions artifacts for seven days; it does not
publish a GitHub Release or replace updater metadata.

The matrix builds x64 and ARM64 for Windows, macOS and Linux. Names come from
Tauri's `productName: Rayburst` and the Cargo package `rayburst`:

| Platform | Packages                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | `Rayburst_<version>_{x64,arm64}-setup.exe`                                                                                         |
| macOS    | `Rayburst_<version>_{x64,aarch64}.dmg`; `Rayburst_{x64,aarch64}.app.tar.gz`                                                        |
| Linux    | `Rayburst_<version>_{amd64,aarch64}.AppImage`; `Rayburst_<version>_{amd64,arm64}.deb`; `Rayburst-<version>-1.{x86_64,aarch64}.rpm` |

The installed application is `rayburst` (`rayburst.exe` on Windows), with
`rayburst-browser-launcher` and the bundled `rayburst-engine` sidecar. The engine
alias does not rename the independent Aria2 Next project.

Local `pnpm tauri build` uses `createUpdaterArtifacts: false` and has no update
origin by default. Release builds apply the native
[Tauri configuration overlay](../src-tauri/tauri.release.conf.json) to generate
updater artifacts. Configure these GitHub Actions values before publication:

| Type     | Name                                 | Purpose                                                               |
| -------- | ------------------------------------ | --------------------------------------------------------------------- |
| Variable | `RAYBURST_UPDATE_BASE_URL`           | HTTPS directory containing the channel JSON files; compiled into Rust |
| Secret   | `TAURI_SIGNING_PRIVATE_KEY`          | Private key matching the updater public key in `tauri.conf.json`      |
| Secret   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that private key, if encrypted                           |

The current uploader writes to the repository's persistent `updater` release.
For that deployment, the base is
`https://github.com/<owner>/<repository>/releases/download/updater`.
Review the destination before enabling publication; do not infer a new repository
name from the Rayburst brand. An unset base hides update controls in local builds.
Changing it requires rebuilding the application.

The published-release job generates `latest.json` or `beta.json` after all builds
succeed. Keep the `updater` release: clients fetch its assets directly. Six build
targets produce ten updater platform entries, including separate Linux package
formats. See [Tauri updater documentation](https://v2.tauri.app/plugin/updater/)
and [Code signing](CODE_SIGNING.md) for the two distinct signing mechanisms.

There is no automatic Homebrew update or store submission in this workflow.

## Release notes and recovery

Write release notes in English. Use `v<version> — <specific change>` as the title.
Explain user-visible changes, required manual steps and known limitations. Put
breaking changes first. Use Changed and Fixed sections only when needed; omit
empty sections, commit dumps, unsupported performance claims and promotional
comparisons with another project. Include the correct architecture/package choices.
When preparing copy for manual publication, provide the title and body in separate
code blocks. Do not claim that artifacts are signed or available before verification.

For an infrastructure failure, rerun the failed job against the same commit.
Changed source needs a new version and tag; do not delete a published tag to reuse
its version. A rollback ships the reverted source as a higher version. Windows
signing may replace installers from the same source, but must regenerate their
updater signatures and channel metadata afterward. Never pair old signatures with
changed bytes.
