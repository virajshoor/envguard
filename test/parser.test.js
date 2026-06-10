const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEnvContent, parseSchemaContent } = require('../lib/parser');

test('parses regex flags and quoted default values with colons', () => {
  const schema = parseSchemaContent([
    'NODE_ENV:string:required:Environment:/^prod$/i',
    'CALLBACK_URL:url:optional:Callback URL:default="https://example.com/callback"',
    ''
  ].join('\n'));

  assert.equal(schema.NODE_ENV.pattern.test('PROD'), true);
  assert.equal(schema.CALLBACK_URL.defaultValue, 'https://example.com/callback');
});

test('reports malformed regex flags with schema line context', () => {
  assert.throws(
    () => parseSchemaContent('NODE_ENV:string:required:Environment:/prod/z'),
    /Invalid regex on schema line 1: Invalid flags supplied to RegExp constructor/
  );
});

test('rejects malformed conditional expressions clearly', () => {
  assert.throws(
    () => parseSchemaContent([
      'NODE_ENV:string:required:Environment',
      'SENTRY_DSN:url:optional:Sentry DSN',
      '@require-if:NODE_ENV=:SENTRY_DSN',
      ''
    ].join('\n')),
    /Invalid conditional rule on schema line 3: expected @require-if:KEY=value:TARGET\[:reason\]/
  );
});

test('documents that raw colons in schema descriptions are ambiguous', () => {
  assert.throws(
    () => parseSchemaContent('PORT:port:required:HTTP: port'),
    /Invalid schema modifier on line 1: port/
  );
});

test('rejects prototype-polluting env keys', () => {
  assert.throws(
    () => parseEnvContent('__proto__=evil'),
    /Invalid .env key on line 1: __proto__/
  );
  assert.throws(
    () => parseEnvContent('constructor=evil'),
    /Invalid .env key on line 1: constructor/
  );
});

test('rejects prototype-polluting schema keys', () => {
  assert.throws(
    () => parseSchemaContent('__proto__:string:required:Bad key'),
    /Invalid schema key on schema line 1: __proto__/
  );
  assert.throws(
    () => parseSchemaContent([
      'NODE_ENV:string:required:Environment',
      'SENTRY_DSN:url:optional:Sentry DSN',
      '@require-if:__proto__=x:SENTRY_DSN',
      ''
    ].join('\n')),
    /Invalid conditional source key on schema line 3: __proto__/
  );
});

test('parsed env and schema objects have no inherited prototype', () => {
  assert.equal(Object.getPrototypeOf(parseEnvContent('A=1')), null);
  assert.equal(Object.getPrototypeOf(parseSchemaContent('A:string:required:x')), null);
});

test('sanitizes control characters in parse error messages', () => {
  assert.throws(
    () => parseEnvContent('BAD\u001b[31mKEY=x'),
    (error) => !error.message.includes('\u001b') && /BAD\?\[31mKEY/.test(error.message)
  );
});
