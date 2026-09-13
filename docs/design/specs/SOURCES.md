# Research and implementation references

Reviewed on 2026-09-13. These sources inform this desktop design pack; the chosen Rayburst reference and native repository contracts determine the product-specific result. No claim is made that the generated images are award-winning or validated implementations.

## Deliverable terminology and handoff

- [Figma: Wireframe vs. mockup](https://www.figma.com/resource-library/wireframe-vs-mockup/) distinguishes structure sketches from visual mockups. This deliverable is a static high-fidelity mockup collection.
- [Figma: Optimize design files for developer handoff](https://help.figma.com/hc/en-us/articles/360040521453-Optimize-design-files-for-developer-handoff) recommends meaningful component documentation, variants/states and accessibility context. This pack uses numbered screens, component rules and a coverage manifest; it is not an editable Figma file.
- [Figma: What is prototyping?](https://www.figma.com/resource-library/what-is-prototyping/) explains prototypes used to test behavior. This gallery does not simulate download operations or validate animation.

## Behavior and accessibility

- [Carbon: Empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/) supports treating initial use, absent results and system problems as distinct contexts. We provide state-specific recovery instead of one generic empty page.
- [Carbon: Loading](https://carbondesignsystem.com/patterns/loading-pattern/) informs differentiated first-load, inline-operation and refresh feedback.
- [WAI-ARIA APG: Modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) defines focus containment, Escape behavior and logical focus return. Use maintained primitives instead of reimplementing those mechanics.
- [W3C WCAG 2.2: Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) gives the 24 × 24 CSS pixel baseline with exceptions. Rayburst targets normally use 32–36 px or more.
- [W3C: Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) provides 4.5:1 normal text and 3:1 large text requirements and the actual large-text definition. The document specification corrects the generic skill's inaccurate 18 px threshold.

## Vue, mature primitives and native APIs

- [Vue: Transition](https://vuejs.org/guide/built-ins/transition.html) and [TransitionGroup](https://vuejs.org/guide/built-ins/transition-group.html) provide lifecycle and keyed-list building blocks. Do not clear content before leave completes.
- [Motion for Vue: Layout animation](https://motion.dev/docs/vue-layout-animations) is a candidate for coordinated layout transitions. Adoption requires Tauri verification and a single animation owner.
- [Reka UI: Dialog](https://reka-ui.com/docs/components/dialog) is a candidate for accessible unstyled primitives. The pack does not install it or claim every Reka component has the same maturity.
- [Tauri: Dialog plugin](https://v2.tauri.app/plugin/dialog/) and [window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) support platform-owned file dialogs and window behavior.

These are engineering starting points, not a requirement to use every library. Prefer existing native/maintained capabilities. Choose stable versions that fit the deployed webviews; do not pursue the highest version number or assume an LTS label guarantees suitability.

## Product precedents already investigated

- [Things: Features](https://culturedcode.com/things/features/) informed the use of clear list hierarchy and details that appear when requested.
- [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/) includes Crouton's Interaction award; its task-focused information hierarchy is relevant, not its recipe visuals.
- [Flighty: Behind the Design](https://developer.apple.com/news/?id=970ncww4) informed emphasis on current useful status and familiar interaction.
- [Linear: Design refresh](https://linear.app/now/behind-the-latest-design-refresh) informed quieter navigation and reduced persistent visual furniture. This pack does not label Linear an award winner.
- [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion) is a behavioral reference, not a mandate to use Apple materials. The normal web page requires JavaScript; earlier investigation used Apple's official DocC representation.

## Local source evidence

- docs/DOWNLOADS.md: native submission, receipts, filename ownership and SQLite authority.
- docs/MEDIA.md: media selection, live duration, native publication and retry identity.
- src/shared/types.ts: 127 explicit AppConfig fields; all mapped in SETTINGS-MAP.md.
- src/shared/configConstraints.ts: numeric validation, ranges and allowed presets.
- src/shared/configKeys.ts and aria2Options.json: native/hot-change/restart boundaries.
- src/composables/usePreferenceForm.ts: draft, validation, hot update, persistence and rollback.
- src/components/task/TaskItemActions.vue and shared task/media utilities: action eligibility.
- src/components/task/TaskDetail.vue and detail components: files, sources, peers, trackers, activity and options.
- src/stores/taskSelection.ts: task-selection queue identity.
- src/composables/useTaskSort.ts: scope-specific sorting and manual order.
- src/components/layout/WindowControls.vue, usePlatform.ts and native configs: platform chrome and current window limits.
- src/composables/useDatabaseReset.ts, src/stores/database.ts, src-tauri/src/commands/database.rs: explicit reset and application restart.
- src/shared/utils/colorScheme.ts, useColorScheme.ts and src/styles/tokens.css: existing Material Color Utilities ownership.
- src/assets/rayburst.svg: authoritative logo.

The source links above are repository-relative descriptions to avoid implying that a screenshot replaces a contract. Future implementation must re-read changed contracts.

## Skills used

imagegen for all generated raster work; frontend-design for restraint and fidelity to the selected visual; design-system for primitive/semantic/component specification and state coverage; ui-ux-pro-max for focused keyboard/focus and Vue guidance. Generic palette changes, a new marketing template, custom agents and unrelated workflows were not adopted. The user-selected brand/layout and repository rules take precedence over generic skill examples.
