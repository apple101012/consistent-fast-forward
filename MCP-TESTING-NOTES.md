# MCP and Automation Notes

Date checked: 2026-03-13

## What is practical right now
- Firefox-first development and validation with `web-ext` (`lint`, `run`, `build`) is stable and recommended.
- Automated logic testing is in this repo via `vitest`.
- Extension end-to-end automation is easiest on Chromium today when using Playwright extension automation patterns.

## MCP status
- The official Playwright MCP server supports launching Playwright browsers (Chromium, Firefox, WebKit), but its extension mode is documented for Chrome/Edge style workflows.
- Result: MCP can help with browser automation, but Firefox extension-specific automation is still less direct than Chromium extension automation.

## Recommended workflow for this project
1. Keep Firefox as the product target and release channel.
2. Run automated unit/integration logic tests on every commit (`npm run verify`).
3. Use `web-ext` lint/build each commit and `web-ext run` for quick Firefox smoke tests.
4. Add optional Chromium end-to-end automation later if we need deeper UI regression automation.

## Sources
- https://github.com/microsoft/playwright-mcp
- https://playwright.dev/docs/chrome-extensions
- https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/
