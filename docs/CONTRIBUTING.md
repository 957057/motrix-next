# Contributing to Rayburst

Use the repository's pinned pnpm version. See [README](../README.md) for local setup.

## Code

- Keep code, comments and engineering documentation in English.
- Prefer native platform APIs and established library tools. Keep modules focused;
  file length is a review signal, not a reason to split a coherent operation.
- Use strict TypeScript and Vue Composition API. Avoid test-only abstractions,
  duplicate configuration and speculative fallback behavior.
- Comments explain ownership, constraints and non-obvious decisions.
- Validate external inputs and preserve download identity and credential boundaries.
- Remove obsolete code and its tests together. Keep tests for real behavior and
  confirmed regressions; do not assert copied implementation details.

## Localization and branding

Update all 27 locales in one batch. Preserve message placeholders and accessible labels.
The existing locale registries and validation commands own consistency.
`src/assets/rayburst.svg` is the editable logo source. Generate platform formats with the project's
existing asset command; do not enlarge a small PNG or hand-edit derived icons.
Electric Purple uses the seed `#7B3ED1` through Material Color Utilities.

## Checks

```sh
pnpm lint
pnpm format:check
pnpm check:repo
pnpm build
pnpm build:native-launcher
cargo check --manifest-path src-tauri/Cargo.toml --workspace --all-targets
```

Module tests run with `pnpm test`; desktop native tests use Cargo. No tests import
another repository or require a parent workspace. Real browser, desktop and engine
acceptance is performed manually. Do not use browser automation for app validation.

## Changes and distribution

Use conventional commit messages. Describe the actual behavior and checks performed.
Do not publish, change repository identities or submit to stores as part of local
implementation. Version changes use the existing version script and require a
separate release task. [Releasing](RELEASING.md) defines version sources, channels,
release notes, artifact checks and publication steps. Keep the existing website
outside the Rayburst rebrand. Preserve third-party license and copyright notices.
