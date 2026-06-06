# Changelog

All notable changes to envguard will be documented here.

## Unreleased

- Added CI coverage for tests, lint, smoke checks, and package dry-runs.
- Added GitHub Action support for the `secrets` input.
- Added a stable package root export through `lib/index.js`.
- Added smoke and package dry-run scripts.
- Added schema modifiers: `default=value`, `allow-empty`, `deprecated`, and
  `deprecated=reason`.
- Added `@require-if-missing` and `@forbidden-if` schema rules.
- Added opt-in local secret hygiene warnings with `envguard check --secrets`.
- Added starter presets with `envguard init --preset`.
- Added duplicate schema key and conditional-reference validation.
- Added JSON warning counts and warning severity in machine-readable output.
- Added contributor and security documentation.
