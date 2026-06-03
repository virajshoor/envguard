# Security Policy

## Reporting a vulnerability

Please report security issues privately by emailing the maintainer listed on the
npm package or by opening a minimal private advisory where available.

Do not include real secrets in reports. Use placeholder values that reproduce
the behavior.

## Local-first security model

envguard is designed to run without network access:

- No telemetry.
- No update checks.
- No analytics.
- No provider API calls.
- No env values in JSON or table output.

Secret hygiene checks are local string-pattern warnings. They are useful
guardrails, not a substitute for a secret scanner or credential rotation
process.
