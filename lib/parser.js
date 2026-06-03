const fs = require('fs');

function stripInlineComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];

    if (char === "'" && !inDoubleQuote && previous !== '\\') {
      inSingleQuote = !inSingleQuote;
    }

    if (char === '"' && !inSingleQuote && previous !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      const before = value[index - 1];
      if (!before || /\s/.test(before)) {
        return value.slice(0, index).trim();
      }
    }
  }

  return value.trim();
}

function unquote(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if (first === "'" && last === "'") {
    return value.slice(1, -1);
  }

  if (first === '"' && last === '"') {
    return value.slice(1, -1).replace(/\\([nrt"\\])/g, (_match, escaped) => {
      const escapes = {
        n: '\n',
        r: '\r',
        t: '\t',
        '"': '"',
        '\\': '\\'
      };

      return escapes[escaped];
    });
  }

  return value;
}

function parseEnvContent(content) {
  const env = {};
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      return;
    }

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf('=');

    if (equalsIndex === -1) {
      throw new Error(`Invalid .env line ${lineNumber}: expected KEY=value`);
    }

    const key = normalized.slice(0, equalsIndex).trim();
    const rawValue = normalized.slice(equalsIndex + 1);

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid .env key on line ${lineNumber}: ${key}`);
    }

    if (Object.prototype.hasOwnProperty.call(env, key)) {
      throw new Error(`Duplicate .env key on line ${lineNumber}: ${key}`);
    }

    env[key] = unquote(stripInlineComment(rawValue));
  });

  return env;
}

function splitSchemaLine(line) {
  const parts = [];
  let current = '';
  let inRegex = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '/' && (current === '' || inRegex)) {
      inRegex = !inRegex;
      current += char;
      continue;
    }

    if (char === ':' && !inRegex) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function parseRegex(pattern, lineNumber) {
  if (!pattern) {
    return null;
  }

  if (!pattern.startsWith('/')) {
    throw new Error(`Invalid regex on schema line ${lineNumber}: expected /pattern/`);
  }

  const lastSlash = pattern.lastIndexOf('/');
  if (lastSlash === 0) {
    throw new Error(`Invalid regex on schema line ${lineNumber}: missing closing /`);
  }

  const source = pattern.slice(1, lastSlash);
  const flags = pattern.slice(lastSlash + 1);
  return new RegExp(source, flags);
}

function assertEnvKey(key, lineNumber, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid ${label} key on schema line ${lineNumber}: ${key}`);
  }
}

function parseModifiers(modifiers, lineNumber) {
  const parsed = {
    defaultValue: undefined,
    allowEmpty: false,
    deprecated: false,
    deprecatedReason: ''
  };

  modifiers.forEach((modifier) => {
    if (modifier === 'allow-empty') {
      parsed.allowEmpty = true;
      return;
    }

    if (modifier === 'deprecated') {
      parsed.deprecated = true;
      return;
    }

    if (modifier.startsWith('deprecated=')) {
      parsed.deprecated = true;
      parsed.deprecatedReason = modifier.slice('deprecated='.length).trim();
      return;
    }

    if (modifier.startsWith('default=')) {
      parsed.defaultValue = unquote(modifier.slice('default='.length).trim());
      return;
    }

    throw new Error(`Invalid schema modifier on line ${lineNumber}: ${modifier}`);
  });

  return parsed;
}

function parseSchemaContent(content) {
  const schema = {};
  Object.defineProperty(schema, '__conditions', {
    value: [],
    enumerable: false,
    writable: true
  });
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      return;
    }

    const parts = splitSchemaLine(line);
    const [key, type, requiredFlag, description = '', ...rest] = parts;
    let pattern = '';
    let modifiers = rest;

    if (rest[0] === '') {
      modifiers = rest.slice(1);
    } else if (rest[0] && rest[0].startsWith('/')) {
      pattern = rest[0];
      modifiers = rest.slice(1);
    }

    if (key === '@require-if' || key === '@forbidden-if') {
      const [sourceKey, expectedValue] = (type || '').split('=');
      const targetKey = requiredFlag;

      if (!sourceKey || expectedValue === undefined || !targetKey) {
        throw new Error(`Invalid conditional rule on schema line ${lineNumber}: expected ${key}:KEY=value:TARGET[:reason]`);
      }

      assertEnvKey(sourceKey, lineNumber, 'conditional source');
      assertEnvKey(targetKey, lineNumber, 'conditional target');

      schema.__conditions.push({
        type: key.slice(1),
        sourceKey,
        expectedValue,
        targetKey,
        reason: description || (
          key === '@require-if'
            ? `${targetKey} is required when ${sourceKey}=${expectedValue}`
            : `${targetKey} is forbidden when ${sourceKey}=${expectedValue}`
        )
      });
      return;
    }

    if (key === '@require-if-missing') {
      const sourceKey = type;
      const targetKey = requiredFlag;

      if (!sourceKey || !targetKey) {
        throw new Error(`Invalid conditional rule on schema line ${lineNumber}: expected @require-if-missing:SOURCE:TARGET[:reason]`);
      }

      assertEnvKey(sourceKey, lineNumber, 'conditional source');
      assertEnvKey(targetKey, lineNumber, 'conditional target');

      schema.__conditions.push({
        type: 'require-if-missing',
        sourceKey,
        targetKey,
        reason: description || `${targetKey} is required when ${sourceKey} is missing`
      });
      return;
    }

    if (!key || !type || !requiredFlag) {
      throw new Error(`Invalid schema line ${lineNumber}: expected KEY:type:required|optional[:description][:/pattern/][:modifier]`);
    }

    assertEnvKey(key, lineNumber, 'schema');

    if (!['required', 'optional'].includes(requiredFlag)) {
      throw new Error(`Invalid required flag on schema line ${lineNumber}: ${requiredFlag}`);
    }

    if (Object.prototype.hasOwnProperty.call(schema, key)) {
      throw new Error(`Duplicate schema key on line ${lineNumber}: ${key}`);
    }

    schema[key] = {
      key,
      type,
      required: requiredFlag === 'required',
      description,
      pattern: parseRegex(pattern, lineNumber),
      ...parseModifiers(modifiers, lineNumber)
    };
  });

  schema.__conditions.forEach((condition) => {
    if (!Object.prototype.hasOwnProperty.call(schema, condition.sourceKey)) {
      throw new Error(`Conditional rule references undeclared source key: ${condition.sourceKey}`);
    }

    if (!Object.prototype.hasOwnProperty.call(schema, condition.targetKey)) {
      throw new Error(`Conditional rule references undeclared target key: ${condition.targetKey}`);
    }
  });

  return schema;
}

function parseEnvFile(filePath) {
  return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
}

function parseSchemaFile(filePath) {
  return parseSchemaContent(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  parseEnvContent,
  parseEnvFile,
  parseSchemaContent,
  parseSchemaFile
};
