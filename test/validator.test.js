const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseEnvContent, parseSchemaContent } = require('../lib/parser');
const { validate, checkType, isBoolean, isEmail, isJson, isPort, isUrl } = require('../lib/validator');
const { schemaFromPreset } = require('../lib/presets');
const { secretWarnings } = require('../lib/secrets');

test('validates a correct env file', () => {
  const env = parseEnvContent(`
NODE_ENV=production
PORT=8080
DATABASE_URL=https://example.com/db
ADMIN_EMAIL=ops@example.com
FEATURE_FLAGS=false
`);

  const schema = parseSchemaContent(`
NODE_ENV:string:required:Environment:/^(development|test|production)$/
PORT:port:required:HTTP port
DATABASE_URL:url:required:Database URL
ADMIN_EMAIL:email:optional:Admin email
FEATURE_FLAGS:boolean:optional:Flags enabled
`);

  const results = validate(env, schema);
  assert.equal(results.every((result) => result.pass), true);
});

test('reports missing required keys', () => {
  const env = parseEnvContent('PORT=3000');
  const schema = parseSchemaContent('DATABASE_URL:url:required:Database URL');
  const [result] = validate(env, schema);

  assert.equal(result.pass, false);
  assert.equal(result.reason, 'Missing required key');
});

test('allows missing optional keys', () => {
  const env = parseEnvContent('');
  const schema = parseSchemaContent('ADMIN_EMAIL:email:optional:Admin email');
  const [result] = validate(env, schema);

  assert.equal(result.pass, true);
  assert.equal(result.reason, 'Optional key not set');
});

test('rejects empty values', () => {
  const env = parseEnvContent('API_KEY=');
  const schema = parseSchemaContent('API_KEY:string:required:API key');
  const [result] = validate(env, schema);

  assert.equal(result.pass, false);
  assert.equal(result.reason, 'Value is empty');
});

test('checks supported types', () => {
  assert.equal(isBoolean('true'), true);
  assert.equal(isBoolean('yes'), false);
  assert.equal(isUrl('https://example.com'), true);
  assert.equal(isUrl('ftp://example.com'), false);
  assert.equal(isEmail('dev@example.com'), true);
  assert.equal(isEmail('dev@localhost'), false);
  assert.equal(isPort('65535'), true);
  assert.equal(isPort('70000'), false);
  assert.equal(isJson('{"enabled":true}'), true);
  assert.equal(isJson('{enabled:true}'), false);
});

test('enforces regex patterns', () => {
  const env = parseEnvContent('NODE_ENV=staging');
  const schema = parseSchemaContent('NODE_ENV:string:required:Environment:/^(development|test|production)$/');
  const [result] = validate(env, schema);

  assert.equal(result.pass, false);
  assert.equal(result.reason, 'Does not match /^(development|test|production)$/');
});

test('parses quoted values and inline comments', () => {
  const env = parseEnvContent(`
APP_NAME="Env Guard" # visible app name
SECRET='abc#123'
`);

  assert.equal(env.APP_NAME, 'Env Guard');
  assert.equal(env.SECRET, 'abc#123');
});

test('handles common real-world dotenv syntax', () => {
  const env = parseEnvContent([
    'export API_URL=https://example.com/path#fragment',
    'SPACED = value with spaces   # inline note',
    'DOUBLE_QUOTED="hello \\"envguard\\""',
    'ESCAPED="line one\\nline two\\tTabbed"',
    "SINGLE_QUOTED='line one\\nline two'",
    ''
  ].join('\r\n'));

  assert.equal(env.API_URL, 'https://example.com/path#fragment');
  assert.equal(env.SPACED, 'value with spaces');
  assert.equal(env.DOUBLE_QUOTED, 'hello "envguard"');
  assert.equal(env.ESCAPED, 'line one\nline two\tTabbed');
  assert.equal(env.SINGLE_QUOTED, 'line one\\nline two');
});

test('reports duplicate dotenv keys with line numbers', () => {
  assert.throws(
    () => parseEnvContent('API_KEY=first\nAPI_KEY=second\n'),
    /Duplicate \.env key on line 2: API_KEY/
  );
});

test('supports enum, numeric ranges, and json schema types', () => {
  const env = parseEnvContent(`
NODE_ENV=production
RETRIES=3
SAMPLING_RATE=0.5
FEATURE_CONFIG={"beta":true}
`);

  const schema = parseSchemaContent(`
NODE_ENV:enum(development,test,production):required:Environment
RETRIES:integer(1,5):required:Retry count
SAMPLING_RATE:float(0,1):required:Sampling rate
FEATURE_CONFIG:json:required:Feature config
`);

  const results = validate(env, schema);
  assert.equal(results.every((result) => result.pass), true);
});

test('reports strict mode keys that are missing from the schema', () => {
  const env = parseEnvContent(`
PORT=3000
TYPOED_SECRET=abc
`);
  const schema = parseSchemaContent('PORT:port:required:HTTP port');
  const results = validate(env, schema, { strict: true });

  assert.equal(results.some((result) => result.key === 'TYPOED_SECRET' && result.reason === 'Unknown key not in schema'), true);
});

test('enforces conditional required keys', () => {
  const env = parseEnvContent('NODE_ENV=production');
  const schema = parseSchemaContent(`
NODE_ENV:enum(development,test,production):required:Environment
SENTRY_DSN:url:optional:Sentry DSN
@require-if:NODE_ENV=production:SENTRY_DSN:SENTRY_DSN is required in production
`);
  const results = validate(env, schema);

  assert.equal(results.some((result) => result.key === 'SENTRY_DSN' && result.reason === 'SENTRY_DSN is required in production'), true);
  assert.equal(results.some((result) => result.key === 'SENTRY_DSN' && result.reason === 'Optional key not set'), false);
});

test('supports defaults, allow-empty, and deprecated warnings', () => {
  const env = parseEnvContent(`
LEGACY_TOKEN=old-token-value
EMPTY_NOTE=
`);
  const schema = parseSchemaContent(`
PORT:port:required:HTTP port:default=3000
EMPTY_NOTE:string:optional:Can be empty::allow-empty
LEGACY_TOKEN:string:optional:Old token::deprecated=Move to API_TOKEN
`);
  const results = validate(env, schema);

  assert.equal(results.find((result) => result.key === 'PORT').reason, 'Default declared in schema');
  assert.equal(results.find((result) => result.key === 'EMPTY_NOTE').pass, true);
  assert.equal(results.find((result) => result.key === 'LEGACY_TOKEN').severity, 'warning');
});

test('rejects invalid defaults', () => {
  const env = parseEnvContent('');
  const schema = parseSchemaContent('PORT:port:optional:HTTP port:default=banana');
  const [result] = validate(env, schema);

  assert.equal(result.pass, false);
  assert.equal(result.reason, 'Invalid schema default: Expected a port between 1 and 65535');
});

test('supports expanded conditional rules', () => {
  const env = parseEnvContent(`
NODE_ENV=production
PASSWORD_AUTH=false
PASSWORD=still-set
`);
  const schema = parseSchemaContent(`
NODE_ENV:enum(development,test,production):required:Environment
DATABASE_URL:url:optional:Primary database
DATABASE_SOCKET:string:optional:Database socket
PASSWORD_AUTH:boolean:required:Password auth
PASSWORD:string:optional:Password
@require-if-missing:DATABASE_URL:DATABASE_SOCKET:DATABASE_SOCKET is required without DATABASE_URL
@forbidden-if:PASSWORD_AUTH=false:PASSWORD:PASSWORD must not be set when password auth is disabled
`);
  const results = validate(env, schema);

  assert.equal(results.some((result) => result.key === 'DATABASE_SOCKET' && !result.pass), true);
  assert.equal(results.some((result) => result.key === 'PASSWORD' && !result.pass), true);
});

test('rejects duplicate schema keys and dangling conditional references', () => {
  assert.throws(
    () => parseSchemaContent('PORT:port:required:HTTP port\nPORT:string:optional:Duplicate\n'),
    /Duplicate schema key on line 2: PORT/
  );
  assert.throws(
    () => parseSchemaContent('NODE_ENV:string:required:Environment\n@require-if:NODE_ENV=production:SENTRY_DSN\n'),
    /Conditional rule references undeclared target key: SENTRY_DSN/
  );
});

test('rejects invalid type arguments and ranges', () => {
  assert.equal(checkType('ok', 'string(foo)'), 'Type "string" does not accept arguments');
  assert.equal(checkType('2', 'integer(1.5,3)'), 'Invalid integer range');
  assert.equal(checkType('2', 'number(10,1)'), 'Invalid number range');
});

test('reports secret hygiene warnings without failing validation', () => {
  const env = parseEnvContent(`
NODE_ENV=production
JWT_SECRET=short
DATABASE_URL=http://localhost:5432/app
STRIPE_SECRET_KEY=sk_test_123
`);
  const warnings = secretWarnings(env);

  assert.equal(warnings.every((result) => result.pass), true);
  assert.equal(warnings.every((result) => result.severity === 'warning'), true);
  assert.equal(warnings.some((result) => result.key === 'JWT_SECRET'), true);
  assert.equal(warnings.some((result) => result.reason === 'Production value points at localhost'), true);
  assert.equal(warnings.some((result) => result.reason === 'Production value looks like a test credential'), true);
});

test('prints machine-readable json without env values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-json-'));
  const envPath = path.join(directory, '.env');
  const schemaPath = path.join(directory, '.env.schema');
  fs.writeFileSync(envPath, 'PORT=banana\n', 'utf8');
  fs.writeFileSync(schemaPath, 'PORT:port:required:HTTP port\n', 'utf8');

  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'envguard.js'),
    'check',
    '--env',
    envPath,
    '--schema',
    schemaPath,
    '--json'
  ], { encoding: 'utf8' });

  const output = JSON.parse(result.stdout);
  assert.equal(result.status, 1);
  assert.equal(output.valid, false);
  assert.equal(output.results[0].key, 'PORT');
  assert.equal(Object.prototype.hasOwnProperty.call(output.results[0], 'value'), false);
});

test('prints json warning counts for secret checks', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-json-warn-'));
  const envPath = path.join(directory, '.env');
  const schemaPath = path.join(directory, '.env.schema');
  fs.writeFileSync(envPath, 'NODE_ENV=production\nJWT_SECRET=abcdefghijklmnop\n', 'utf8');
  fs.writeFileSync(schemaPath, 'NODE_ENV:string:required:Environment\nJWT_SECRET:string:required:JWT secret\n', 'utf8');

  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'envguard.js'),
    'check',
    '--env',
    envPath,
    '--schema',
    schemaPath,
    '--secrets',
    '--json'
  ], { encoding: 'utf8' });

  const output = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(output.valid, true);
  assert.equal(output.summary.warnings, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(output.results.find((item) => item.key === 'JWT_SECRET'), 'value'), false);
});

test('generates a schema from an existing env file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-init-'));
  const envPath = path.join(directory, '.env.example');
  const schemaPath = path.join(directory, '.env.schema');
  fs.writeFileSync(envPath, [
    'PORT=3000',
    'DATABASE_URL=https://example.com/db',
    'FEATURE_FLAGS=false',
    'MAX_RETRIES=3',
    'AIRPORT=3000',
    ''
  ].join('\n'), 'utf8');

  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'envguard.js'),
    'init',
    '--from',
    envPath,
    '--schema',
    schemaPath
  ], { encoding: 'utf8' });

  const schema = fs.readFileSync(schemaPath, 'utf8');
  assert.match(schema, /PORT:port:required/);
  assert.match(schema, /DATABASE_URL:url:required/);
  assert.match(schema, /FEATURE_FLAGS:boolean:required/);
  assert.match(schema, /MAX_RETRIES:integer:required/);
  assert.match(schema, /AIRPORT:integer:required/);
});

test('generates preset schemas', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-preset-'));
  const schemaPath = path.join(directory, '.env.schema');

  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'envguard.js'),
    'init',
    '--preset',
    'nextjs',
    '--schema',
    schemaPath
  ], { encoding: 'utf8' });

  const schema = fs.readFileSync(schemaPath, 'utf8');
  assert.match(schema, /Generated by envguard init --preset nextjs/);
  assert.match(schema, /AUTH_SECRET:string:optional/);
  assert.equal(schemaFromPreset('unknown'), null);
  assert.equal(schemaFromPreset('__proto__'), null);
  assert.equal(schemaFromPreset('constructor'), null);
});
