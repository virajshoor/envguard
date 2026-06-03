# Changelog

All notable changes to envguard will be documented here.

## Unreleased

- Added schema modifiers: `default=value`, `allow-empty`, `deprecated`, and
  `deprecated=reason`.
- Added `@require-if-missing` and `@forbidden-if` schema rules.
- Added opt-in local secret hygiene warnings with `envguard check --secrets`.
- Added starter presets with `envguard init --preset`.
- Added duplicate schema key and conditional-reference validation.
- Added JSON warning counts and warning severity in machine-readable output.
- Added contributor and security documentation.
