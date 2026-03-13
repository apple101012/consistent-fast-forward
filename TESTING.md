# Testing Strategy

## Automated Coverage
- Unit tests cover settings normalization, site rule resolution, editable-input safety guards, video targeting, and seek clamping.
- Extension lint (`web-ext lint`) validates manifest and extension packaging rules for Firefox.

## Local Commands
```bash
npm run test
npm run lint:ext
npm run verify
```

## Manual Smoke Test (Firefox)
1. Run `npm run run:firefox`.
2. Open a site with HTML5 video.
3. Verify `ArrowLeft` seeks backward and `ArrowRight` seeks forward.
4. On a site that already has arrow-key skip (for example +10s), verify only the extension interval is applied (no stacked skip).
5. Focus an input field and verify arrow keys are not hijacked.
6. Open extension settings and change intervals; verify behavior updates.

## Optional Chromium Smoke Test
Load `extension/` as unpacked extension in a Chromium-based browser and repeat the same keyboard/input checks.

## Future Automation
- Add end-to-end browser tests after selecting a stable browser automation bridge for extension contexts.
- Candidate path: Playwright-based harness for Chromium plus Firefox WebDriver harness for Firefox-only checks.
