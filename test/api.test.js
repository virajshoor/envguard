const test = require('node:test');
const assert = require('node:assert/strict');
const envguard = require('..');

test('package root exports the public programmatic API', () => {
  assert.equal(typeof envguard.parseEnvContent, 'function');
  assert.equal(typeof envguard.parseSchemaContent, 'function');
  assert.equal(typeof envguard.validate, 'function');
  assert.equal(typeof envguard.checkType, 'function');
  assert.equal(typeof envguard.secretWarnings, 'function');
  assert.equal(typeof envguard.schemaFromPreset, 'function');
  assert.equal(typeof envguard.presetNames, 'function');
  assert.equal(typeof envguard.formatResults, 'function');
});

test('package root can parse and validate an env schema pair', () => {
  const env = envguard.parseEnvContent('PORT=3000');
  const schema = envguard.parseSchemaContent('PORT:port:required:HTTP port');
  const [result] = envguard.validate(env, schema);

  assert.equal(result.pass, true);
});
