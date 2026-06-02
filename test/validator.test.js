const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { parseEnvContent, parseSchemaContent } = require('../lib/parser');
const { validate, isBoolean, isEmail, isJson, isPort, isUrl } = require('../lib/validator');

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

test('generates a schema from an existing env file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-init-'));
  const envPath = path.join(directory, '.env.example');
  const schemaPath = path.join(directory, '.env.schema');
  fs.writeFileSync(envPath, [
    'PORT=3000',
    'DATABASE_URL=https://example.com/db',
    'FEATURE_FLAGS=false',
    'MAX_RETRIES=3',
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
});
