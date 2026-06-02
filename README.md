<div align="center">

```text
######## ##    ## ##     ##  ######   ##     ##    ###    ########  ########
##       ###   ## ##     ## ##    ##  ##     ##   ## ##   ##     ## ##     ##
##       ####  ## ##     ## ##        ##     ##  ##   ##  ##     ## ##     ##
######   ## ## ## ##     ## ##   #### ##     ## ##     ## ########  ##     ##
##       ##  ####  ##   ##  ##    ##  ##     ## ######### ##   ##   ##     ##
##       ##   ###   ## ##   ##    ##  ##     ## ##     ## ##    ##  ##     ##
######## ##    ##    ###     ######    #######  ##     ## ##     ## ########
```

### Validate your env config before it breaks your deploy.

[![npm version](https://img.shields.io/npm/v/@virajshoor/envguard.svg?logo=npm)](https://www.npmjs.com/package/@virajshoor/envguard)
[![npm downloads](https://img.shields.io/npm/dm/@virajshoor/envguard.svg?logo=npm)](https://www.npmjs.com/package/@virajshoor/envguard)
[![CI](https://github.com/virajshoor/envguard/actions/workflows/ci.yml/badge.svg)](https://github.com/virajshoor/envguard/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18.3-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/runtime%20deps-1-brightgreen.svg)](package.json)
[![offline](https://img.shields.io/badge/offline-first-success.svg)](#privacy--offline-first)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](#contributing)

</div>

---

A missing `DATABASE_URL`, a blank `JWT_SECRET`, a port set to `banana`, or a
production-only typo can take down a release **after the code was already fine**.
`envguard` catches those mistakes where they belong: locally, in CI, and before
runtime.

It validates a `.env` file against a small, typed `.env.schema` and **exits
non-zero** when the config is wrong. No magic. No framework lock-in. No network.
Just a sharp guardrail for the files your app already depends on.

```text
Status | Key          | Type   | Required | Reason
-------+--------------+--------+----------+-------------------------------
PASS   | NODE_ENV     | string | yes      | OK
PASS   | PORT         | port   | yes      | OK
FAIL   | DATABASE_URL | url    | yes      | Missing required key
FAIL   | ADMIN_EMAIL  | email  | no       | Expected a valid email address

2/4 checks failed. Fix your env file before deploying.
```

## Highlights

- **Typed validation** — `string`, `number`, `integer`, `float`, `boolean`, `url`, `email`, `port`, `json`, and `enum(...)`.
- **Range and regex rules** — pin numeric values to ranges or strings to exact patterns.
- **Cross-key rules** — require one key only when another key has a specific value.
- **Strict mode** — catch extra env keys that are missing from your schema.
- **JSON output** — machine-readable results for bots, dashboards, and custom CI.
- **CI-ready** — exits `1` on any failure so a bad env fails the pipeline.
- **Offline-first** — zero network calls, zero telemetry. Runs fully air-gapped.
- **Featherweight** — one runtime dependency (`chalk`); everything else is the
  Node.js standard library.
- **Readable output** — a clean pass/fail table, not a wall of JSON.

## Install

```bash
npm install -g @virajshoor/envguard
```

This installs the `envguard` command globally. Or try it instantly with no
install — straight from npm:

```bash
npx @virajshoor/envguard check
```

Or run it from a clone of this repo:

```bash
git clone https://github.com/virajshoor/envguard.git
cd envguard
npm install
node bin/envguard.js check
```

> Requires Node.js **18.3 or newer** (it uses the built-in `util.parseArgs`).

## Quick start

```bash
# 1. Generate a starter schema
envguard init

# 2. Edit .env.schema to describe the keys your app needs

# 3. Validate your .env against it
envguard check
```

Generate a schema from an existing env file:

```bash
envguard init --from .env.example
```

Validate a different env file or schema path:

```bash
envguard check --env .env.production
envguard check --env .env.staging --schema config/env.schema
envguard check --strict --json
```

## The `.env.schema` format

Each non-comment line defines one key:

```text
KEY:type:required|optional[:description][:/regex/]
```

| Field | Required | Description |
| --- | --- | --- |
| `KEY` | yes | Environment variable name (e.g. `DATABASE_URL`, `NODE_ENV`). |
| `type` | yes | One of `string`, `number`, `boolean`, `url`, `email`, `port`. |
| `required` / `optional` | yes | Whether the key must exist in the env file. |
| `description` | no | Human context for the key. |
| `/regex/` | no | Extra pattern the value must match after type validation. |

Example:

```text
# .env.schema
NODE_ENV:enum(development,test,production):required:Application environment
PORT:port:required:HTTP server port
DATABASE_URL:url:required:Database connection URL
ADMIN_EMAIL:email:optional:Admin contact email
FEATURE_FLAGS:boolean:optional:Enable feature flags
SENTRY_DSN:url:optional:Sentry DSN
@require-if:NODE_ENV=production:SENTRY_DSN:SENTRY_DSN is required in production
```

### Supported types

| Type | Passes when |
| --- | --- |
| `string` | Value is present and not empty. |
| `number` | Value is a finite number like `42`, `0`, or `3.14`. |
| `number(min,max)` | Value is a finite number inside the inclusive range. |
| `integer` | Value is a safe integer like `42`, `0`, or `-7`. |
| `integer(min,max)` | Value is an integer inside the inclusive range. |
| `float` | Value is a finite numeric value. |
| `float(min,max)` | Value is a finite numeric value inside the inclusive range. |
| `boolean` | Value is `true` or `false`, case-insensitive. |
| `url` | Value is a valid `http` or `https` URL. |
| `email` | Value looks like a normal email address. |
| `port` | Value is an integer from `1` to `65535`. |
| `json` | Value parses as valid JSON. |
| `enum(a,b,c)` | Value matches one of the listed options exactly. |

Empty values always fail, including optional keys that are present but blank:

```env
API_KEY=
```

### Cross-key rules

Use `@require-if` to make a key required only when another key has a specific
value:

```text
SENTRY_DSN:url:optional:Sentry DSN
@require-if:NODE_ENV=production:SENTRY_DSN:SENTRY_DSN is required in production
```

This keeps development env files lightweight while still protecting production
config.

### Strict mode and JSON output

Strict mode fails when the env file contains keys that are not declared in the
schema:

```bash
envguard check --strict
```

JSON output is secret-safe by default: it reports keys, types, pass/fail status,
and reasons without printing env values.

```bash
envguard check --json
```

## Use in CI

Use the reusable GitHub Action for one-line setup:

```yaml
- uses: virajshoor/envguard@v1
  with:
    env: .env.example
    schema: .env.schema
    strict: true
```

Or run the CLI directly in GitHub Actions:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  envguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @virajshoor/envguard
      - run: envguard check --env .env.example --strict
```

## Privacy & offline-first

`envguard` makes **no outbound requests** of any kind — no telemetry, no update
checks, no analytics. It reads and writes only the files you point it at, and
works completely air-gapped. The single runtime dependency (`chalk`) is used
purely for terminal colors.

## Local development

```bash
npm test                                  # run the test suite
npm run lint                              # syntax-check every source file

# run the CLI against the bundled examples
node bin/envguard.js check \
  --env examples/.env.example \
  --schema examples/.env.schema.example
```

## Contributing

Issues and pull requests are welcome. Keep changes small, practical, and easy to
review. This project is intentionally plain JavaScript with minimal dependencies;
new abstractions and packages should earn their place.

Before opening a PR:

```bash
npm test
npm run lint
```

## License

[GNU GPL v3](LICENSE)
</content>
</invoke>
