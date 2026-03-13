# Consistent Fast Forward

Firefox-first extension for consistent left/right arrow seek behavior across video websites.

## Product Document
- [PRD](./PRD.md)
- [Testing Strategy](./TESTING.md)
- [MCP and Automation Notes](./MCP-TESTING-NOTES.md)

## Repo Layout
- `extension/`: WebExtension source (manifest + content/options scripts)
- `tests/`: automated test cases for seek and targeting logic

## Setup
```bash
npm install
```

## Validation
```bash
npm run test
npm run lint:ext
```

## Run In Firefox
```bash
npm run run:firefox
```

## Optional Packaging
```bash
npm run build:ext
```

## Browser Support
- Primary: Firefox
- Secondary: Chromium-compatible engines (manifest keeps this path open)
