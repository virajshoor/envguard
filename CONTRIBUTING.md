# Contributing

Thanks for improving envguard. This project is intentionally small, local-first,
and dependency-light.

## Local setup

```bash
npm install
npm test
npm run lint
```

Run the CLI from a checkout:

```bash
node bin/envguard.js check \
  --env examples/.env.example \
  --schema examples/.env.schema.example \
  --strict \
  --secrets
```

## Project principles

- Keep validation local. Do not add telemetry, update checks, API calls, or
  provider lookups.
- Keep secrets out of output. JSON and table output must not print env values.
- Prefer plain JavaScript and Node.js standard library APIs.
- Avoid new runtime dependencies unless they remove meaningful complexity.
- Keep schema changes backward-compatible where possible.
- Add focused tests for parser, validator, reporter, and CLI behavior.

## Pull requests

Before opening a PR:

```bash
npm test
npm run lint
```

For user-facing behavior, update `README.md` and `CHANGELOG.md`. For new schema
syntax, include both positive and negative tests.
