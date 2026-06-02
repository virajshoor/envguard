const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEnvContent, parseSchemaContent } = require('../lib/parser');
const { validate, isBoolean, isEmail, isPort, isUrl } = require('../lib/validator');

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
