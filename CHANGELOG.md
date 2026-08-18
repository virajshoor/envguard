# Changelog

All notable changes to envguard will be documented here.

## Unreleased

- Added hand-written TypeScript declarations for the public `lib/index.js` API.
- Added `c8` coverage reporting via `npm run test:coverage`.
- Replaced syntax-only lint with ESLint (`eslint:recommended`) while keeping
  `node --check`.
- Added optional debug logging for swallowed parse errors (`DEBUG=1` or
  `envguard --debug`).

## 1.3.0 - 2026-06-06

- Added CI coverage for tests, lint, smoke checks, and package dry-runs.
- Added GitHub Action support for the `secrets` input.
- Added a stable package root export through `lib/index.js`.
- Added smoke and package dry-run scripts.
- Hardened schema parsing for quoted colon values and clearer regex errors.
- Added focused API, CLI, and parser tests.

## 1.2.0 - 2026-06-03

- Added schema modifiers: `default=value`, `allow-empty`, `deprecated`, and
  `deprecated=reason`.
- Added `@require-if-missing` and `@forbidden-if` schema rules.
- Added opt-in local secret hygiene warnings with `envguard check --secrets`.
- Added starter presets with `envguard init --preset`.
- Added duplicate schema key and conditional-reference validation.
- Added JSON warning counts and warning severity in machine-readable output.
- Added contributor and security documentation.

## 1.1.2 - 2026-06-02

- Improved dotenv parsing for quoted escapes, `export` lines, and Windows
  line endings.
- Fail fast on duplicate `.env` keys with a line-numbered error.

## 1.1.1 - 2026-06-02

- Tightened integer range checks and rejected inverted numeric ranges.
- Stopped reporting "optional key not set" when a conditional rule already
  failed for the same key.
- Ran the GitHub Action from the local checkout instead of `npx`.

## 1.1.0 - 2026-06-02

- Restored verbatim GPL-3.0 license text for license detection.
- Polished README ASCII banner rendering.

## 1.0.0 - 2026-06-02

- Initial release: typed `.env` validation against `.env.schema`, an
  offline-first CLI, and a single runtime dependency.
