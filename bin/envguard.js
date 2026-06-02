#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');
const chalk = require('chalk');
const { parseEnvFile, parseSchemaFile } = require('../lib/parser');
const { validate } = require('../lib/validator');
const { formatResults, formatSummary } = require('../lib/reporter');

const DEFAULT_ENV_FILE = '.env';
const DEFAULT_SCHEMA_FILE = '.env.schema';

function printHelp() {
  console.log(`
${chalk.bold('envguard')} validates .env files against a .env.schema file.

${chalk.bold('Usage')}
  envguard check [--env .env.production] [--schema .env.schema]
  envguard init [--schema .env.schema]

${chalk.bold('Commands')}
  check   Validate an env file
  init    Create a starter schema

${chalk.bold('Options')}
  --env       Env file to validate (default: .env)
  --schema    Schema file to use or create (default: .env.schema)
  --help      Show this help
`);
}

function starterSchema() {
  return [
    '# .env.schema',
    '# Format: KEY:type:required|optional[:description]',
    '# Optional regex: KEY:type:required:description:/pattern/',
    '',
    'NODE_ENV:string:required:Application environment:/^(development|test|production)$/',
    'PORT:port:required:HTTP server port',
    'DATABASE_URL:url:required:Database connection URL',
    'ADMIN_EMAIL:email:optional:Admin contact email',
    'FEATURE_FLAGS:boolean:optional:Enable feature flags',
    ''
  ].join('\n');
}

function resolveFile(filePath) {
  return path.resolve(process.cwd(), filePath);
}

function runInit(args) {
  const schemaPath = resolveFile(args.schema || DEFAULT_SCHEMA_FILE);

  if (fs.existsSync(schemaPath)) {
    console.error(chalk.red('Schema already exists:'), schemaPath);
    process.exitCode = 1;
    return;
  }

  try {
    fs.writeFileSync(schemaPath, starterSchema(), 'utf8');
  } catch (error) {
    console.error(chalk.red('Could not create schema:'), error.message);
    process.exitCode = 1;
    return;
  }

  console.log(chalk.green('Created'), schemaPath);
}

function runCheck(args) {
  const envPath = resolveFile(args.env || DEFAULT_ENV_FILE);
  const schemaPath = resolveFile(args.schema || DEFAULT_SCHEMA_FILE);

  if (!fs.existsSync(envPath)) {
    console.error(chalk.red('Env file not found:'), envPath);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(chalk.red('Schema file not found:'), schemaPath);
    console.error(chalk.gray('Run `envguard init` to create a starter schema.'));
    process.exitCode = 1;
    return;
  }

  try {
    const env = parseEnvFile(envPath);
    const schema = parseSchemaFile(schemaPath);
    const results = validate(env, schema);
    const failures = results.filter((result) => !result.pass);

    console.log(formatResults(results));
    console.log(formatSummary(results));

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(chalk.red('Validation failed:'), error.message);
    process.exitCode = 1;
  }
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        env: { type: 'string' },
        schema: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false }
      }
    });
  } catch (error) {
    console.error(chalk.red('Invalid arguments:'), error.message);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const args = parsed.values;
  const command = parsed.positionals[0];

  if (args.help || !command) {
    printHelp();
    return;
  }

  if (command === 'check') {
    runCheck(args);
    return;
  }

  if (command === 'init') {
    runInit(args);
    return;
  }

  console.error(chalk.red('Unknown command:'), command);
  printHelp();
  process.exitCode = 1;
}

main(process.argv.slice(2));
