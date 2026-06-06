const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cliPath = path.join(__dirname, '..', 'bin', 'envguard.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    ...options
  });
}

test('prints help output', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage/);
  assert.match(result.stdout, /--secrets/);
});

test('reports missing env and schema files', () => {
  const missingEnv = runCli(['check', '--env', 'missing.env', '--schema', 'missing.schema']);
  assert.equal(missingEnv.status, 1);
  assert.match(missingEnv.stderr, /Env file not found/);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-cli-missing-schema-'));
  const envPath = path.join(directory, '.env');
  fs.writeFileSync(envPath, 'PORT=3000\n', 'utf8');

  const missingSchema = runCli(['check', '--env', envPath, '--schema', path.join(directory, '.env.schema')]);
  assert.equal(missingSchema.status, 1);
  assert.match(missingSchema.stderr, /Schema file not found/);
});

test('reports unknown presets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'envguard-cli-preset-'));
  const result = runCli(['init', '--preset', 'unknown', '--schema', path.join(directory, '.env.schema')]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown preset: unknown/);
});

test('runs the bundled strict secret smoke check', () => {
  const result = runCli([
    'check',
    '--env',
    path.join(__dirname, '..', 'examples', '.env.example'),
    '--schema',
    path.join(__dirname, '..', 'examples', '.env.schema.example'),
    '--strict',
    '--secrets'
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Environment is valid/);
});

test('action metadata exposes the CLI secrets option', () => {
  const action = fs.readFileSync(path.join(__dirname, '..', 'action.yml'), 'utf8');

  assert.match(action, /secrets:/);
  assert.match(action, /args\+=\(--secrets\)/);
});
