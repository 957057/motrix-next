# AGENTS.md — Rayburst

## Architecture

Rayburst is an independent Tauri 2 desktop application. Vue 3, Pinia, Naive UI
and TypeScript provide the interface; Rust owns native behavior. Aria2 Next
remains a separate engine with its aria2-compatible interface.

- `src/components/`, `src/composables/`, `src/stores/`: interface and user intent.
- `src/shared/constants.ts`: current defaults and theme presets.
- `src/shared/utils/configHydration.ts`: current-field hydration and validation.
- `src-tauri/src/services/downloads/`: ordinary submissions and receipts.
- `src-tauri/src/services/media/`: media inspection and selection.
- `src-tauri/src/services/tasks/`: task policy, queries and controls.
- `src-tauri/src/database/`: the single SQLite owner for history and receipts.
- `src-tauri/native-messaging/`: allowlisted, activation-only browser launcher.
- `website/`: existing Motrix Next website; excluded from the Rayburst rebrand.

The parent directory is only a convenience workspace. No shared runtime package,
cross-repository tests or build-time imports from other projects.

## Engineering

Use native APIs and maintained libraries before writing new mechanisms. Code,
comments and engineering documentation use English. Use strict TypeScript, Vue
Composition API, structured logging and Rust AppError. Comments explain ownership
and non-obvious constraints. Do not add compatibility aliases or speculative
fallbacks. Keep validation, credential isolation and submission identity.

Only Rust owns database transactions and download state. Vue never executes SQL.
Unsupported database schemas fail explicitly. Initialization never deletes data;
only an explicit user reset does. See docs/DOWNLOADS.md and docs/MEDIA.md.

## Branding and themes

`src/assets/rayburst.svg` is the desktop logo source. `pnpm brand:assets` uses
Tauri for platform formats and Sharp for native tray images. UI uses SVG directly;
macOS tray images are templates. Native installer layouts use the application icon.

Electric Purple (`#7B3ED1`) feeds the existing Material Color Utilities system.
`colorScheme.ts` generates roles; `useColorScheme.ts` maps them to CSS, Naive UI
and Canvas. Components consume semantic colors. `src/styles/tokens.css` holds
matching first-paint defaults only. Do not create another palette generator.

## Localization

Update all 27 locales in one Python batch operation. Preserve placeholders and
accessible text. English `src/shared/locales/en-US/messages.json` is the schema;
`catalog.json` owns metadata; native resources are in `src-tauri/locales/`.
Run `pnpm check:repo` after changes.

## Verification

Repository-local checks: `pnpm lint`, `pnpm format:check`, `pnpm check:repo`,
`pnpm build`, `pnpm build:native-launcher`, and, in src-tauri:
`cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`
and `cargo check --workspace --all-targets`.

Module tests use `pnpm test` and `cargo test --workspace --all-targets`.
Keep behavior and regression tests; remove tests with retired code. No branding
snapshots or wrapper tests. Honor task-specific verification limits. Never use
browser automation for Tauri validation. The maintainer performs real integration
acceptance with separately built applications.

## Local builds and distribution

Work on the current branch. No subagents or orchestration without explicit user
authorization. Publication is a separate task. Follow [Releasing](docs/RELEASING.md)
for the full procedure and [Code signing](docs/CODE_SIGNING.md) for signing setup.

Cargo.toml owns the version; package.json must match. Use scripts/bump-version.sh
after implementation is final, then review both manifests and Cargo.lock.
Stable versions use X.Y.Z; prereleases use -alpha.N, -beta.N or -rc.N. Tags add v.
In an authorized release task, follow the requested version/channel or continue
the current channel with the appropriate SemVer increment. Do not promote silently.

Complete repository checks before scripts/release.sh: it stages all changes,
commits, tags and pushes the current branch and all local tags. Publish the GitHub
Release only after CI passes; a tag push alone does not trigger packaging.
Write concise English notes describing actual changes and breaking behavior.
For manual publication, provide title and body in separate code blocks.
Never retag distributed source; changed code needs a new version.

The application ID is `dev.aninsomniacy.rayburst`, protocol `rayburst://`, and
native host `dev.aninsomniacy.rayburst.browser`. Browser installation IDs remain
stable external identities, not branding aliases.

There is no legacy configuration migration runner. Rayburst uses its own data
directory and does not import another application's data.

Local builds have no update origin. A future release must set
`RAYBURST_UPDATE_BASE_URL` when compiling Rust and configure signing/distribution.
The release workflow uses tauri.release.conf.json to enable native updater artifacts;
local builds keep them disabled.
The native `updates_available` command controls update UI visibility. Do not infer
a release origin from the current GitHub repository name.
