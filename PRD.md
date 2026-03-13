# APRD: Consistent Fast Forward

Document version: 1.0
Date: 2026-03-12
Owner: Apple (Product), Community Contributors (Engineering)
Status: Draft ready for implementation

## 1) Product Summary

### Product Name
Consistent Fast Forward

### One-line Description
A Firefox extension that enforces consistent arrow-key seek behavior across web video players.

### Problem
Different sites map arrow keys to different seek intervals (or different behavior), which creates friction and slows down video navigation.

### Vision
Make video seeking predictable everywhere: left arrow and right arrow should always feel the same unless the user intentionally changes settings.

## 2) Goals and Success Metrics

### Primary Goals
- Standardize left/right seek intervals across generic video websites.
- Keep native playback controls intact when overriding key behavior is unsafe.
- Provide simple settings so users can tune seek intervals.

### Success Metrics (first 90 days)
- 90%+ of tested top video sites pass core seek behavior tests.
- <1% reported breakage involving text inputs and form fields.
- Median extension response time from keydown to seek update <100 ms.
- 70%+ of users keep default settings or only change interval once.

## 3) Users and Jobs-to-be-Done

### Target Users
- Students watching lectures on mixed platforms.
- Developers and researchers consuming long-form technical video.
- General users who multitask and rely on keyboard shortcuts.

### Jobs-to-be-Done
- "When I press arrow keys while watching a video, I want predictable jumps so I do not have to relearn each site."
- "When typing in a text field, I do not want the extension to hijack arrow keys."

## 4) Scope

### V1 Must-Haves
- Intercept left/right arrow key events in supported HTML5 video contexts.
- Default behavior:
  - Left arrow: -5 seconds
  - Right arrow: +5 seconds
- User-configurable seek interval in extension settings.
- Generic multi-site support (not hardcoded to one platform).
- Safe fallback logic when player state or page context is ambiguous.
- Correct handling for pages with multiple video elements.
- Do not trigger while focus is inside input/textarea/contenteditable.

### Nice-to-Haves (Planned after V1, design now)
- Site allowlist and blocklist.
- Per-site custom seek intervals.
- Optional overlay toast ("-5s" / "+5s") with toggle.
- Auto-select currently active/visible playing video in multi-video pages.
- Lightweight telemetry toggle (local-only counters by default).
- Keyboard remapping beyond arrows.
- Import/export settings JSON.
- Localization support for settings UI.

### Explicit Out of Scope (V1)
- Chromium/Safari support.
- DRM/player internals hacks for locked-down custom controls.
- Cloud accounts or remote settings sync service.
- Non-video media shortcuts.

## 5) Functional Requirements

### Core Behavior
- FR-001: Extension MUST process `ArrowLeft` and `ArrowRight` in page contexts with detectable video playback.
- FR-002: `ArrowLeft` MUST seek backward by configured interval.
- FR-003: `ArrowRight` MUST seek forward by configured interval.
- FR-004: Default interval MUST be 5 seconds.
- FR-005: Interval MUST be user-configurable from 1 to 60 seconds (integer).
- FR-006: Settings MUST persist across browser restarts.

### Safety and Context
- FR-007: Extension MUST NOT override arrow keys when focused element is input-like (`input`, `textarea`, `contenteditable`, code editor regions where detectable).
- FR-008: If no valid video target is found, extension MUST do nothing and allow native behavior.
- FR-009: On pages with multiple videos, extension MUST target the active playing video, else largest visible video, else last user-interacted video.
- FR-010: If a seek operation fails, extension MUST fail silently and not break page controls.

### Settings and UX
- FR-011: Popup/options page MUST let users set backward and forward intervals (shared default initially; split values optional in V1.1).
- FR-012: Settings UI MUST include reset-to-default action.
- FR-013: Settings changes MUST apply immediately to newly handled key events.

### Site Controls (Nice-to-have foundation in V1 schema)
- FR-014: Data model MUST reserve fields for allowlist/blocklist even if UI ships in V1.1.
- FR-015: Matching strategy MUST support hostname-based rules.

## 6) Non-Functional Requirements

### Performance
- NFR-001: Keydown handler overhead SHOULD be minimal and avoid frequent DOM scans.
- NFR-002: Video target lookup SHOULD use cached candidates with invalidation hooks.

### Reliability
- NFR-003: Extension SHOULD operate on modern dynamic single-page apps without requiring reload after route changes.
- NFR-004: Error paths SHOULD be logged only in debug mode to avoid noisy console output.

### Privacy and Security
- NFR-005: No collection of personal data in V1.
- NFR-006: All settings stored locally using Firefox extension storage APIs.
- NFR-007: Minimal permissions principle.

### Accessibility
- NFR-008: Options UI MUST be keyboard navigable and screen-reader friendly.
- NFR-009: UI labels MUST have clear text and associated form controls.

## 7) Technical Approach

### Platform
- Firefox WebExtension (Manifest V3 where supported by Firefox at implementation time).

### Components
- Content script:
  - Detects active video element.
  - Handles keyboard events with context checks.
  - Performs safe seek operations.
- Background/service worker:
  - Coordinates storage reads/writes and future rule sync logic.
- Options page:
  - Interval setting, defaults reset, validation.
- Popup (optional in V1):
  - Quick toggle and current interval display.

### Data Model (initial)
- `seekIntervalSeconds`: number (default 5)
- `enabled`: boolean (default true)
- `siteRules`: array of `{ host: string, mode: "allow" | "block", customIntervalSeconds?: number }`
- `debugMode`: boolean (default false)

### Permissions (expected)
- `storage`
- `activeTab` (if required by implementation)
- Host permissions scoped to needed sites pattern strategy

## 8) Edge Cases and Handling

- Multiple videos on page: prioritize actively playing then visible area then last interacted.
- Shadow DOM/custom players: walk composed path and query known media containers.
- Embedded iframes: handle same-origin where permitted; degrade gracefully otherwise.
- Live streams: bound backward seek to available buffer window.
- At start/end boundaries: clamp `currentTime` to valid range.

## 9) Testing and Acceptance

### Test Strategy
- Unit tests for key decision logic and video target selection.
- Integration tests on representative sites (news, LMS, streaming, social clips).
- Manual regression checklist for inputs, editors, and forms.

### Acceptance Criteria for V1 Release
- AC-001: On test matrix sites, arrow keys perform configured seeks when video is in focus context.
- AC-002: Text inputs and editable areas are never hijacked.
- AC-003: Settings persist and apply without browser restart.
- AC-004: No critical breakages in native player controls during regression pass.

## 10) Milestones

- M0: Requirements lock and architecture decisions (1 week)
- M1: Core content script seek engine + storage (1.5 weeks)
- M2: Options UI + validation + persistence (1 week)
- M3: Multi-video and safety hardening (1 week)
- M4: Beta testing across site matrix + bug triage (1 week)
- M5: Firefox Add-ons packaging and publish prep (0.5 week)

Total estimate: 6 weeks for first public release.

## 11) Risks and Mitigations

- Risk: Site-specific player event handling conflicts.
  - Mitigation: Safe fallback and host-level block rules.
- Risk: Keyboard conflicts with web app shortcuts.
  - Mitigation: strict focus/context guardrails and optional disable toggle.
- Risk: Firefox extension API behavior differences by version.
  - Mitigation: compatibility matrix and feature flags.

## 12) Open Questions

- Should backward/forward intervals be separate in V1 or deferred to V1.1?
- Should per-site rules ship in V1 if schedule slips?
- Which telemetry posture is acceptable for public repo contributors (off by default vs none)?

## 13) Launch Plan (Public Repo)

- Include APRD and issue templates.
- Publish initial roadmap and contributor setup docs.
- Tag first milestone issues: `v1-core`, `v1-settings`, `v1-hardening`.

## 14) Nice-to-Have Backlog (Prioritized)

1. Per-site intervals and quick toggle in popup.
2. Allowlist/blocklist management UI.
3. Optional seek overlay feedback.
4. JSON settings import/export.
5. Basic localization.
6. Expanded key remapping profiles.

