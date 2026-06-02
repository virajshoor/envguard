const VALID_TYPES = new Set(['string', 'number', 'boolean', 'url', 'email', 'port', 'integer', 'float', 'json']);

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isNumber(value) {
  return /^-?(?:\d+|\d*\.\d+)$/.test(value) && Number.isFinite(Number(value));
}

function isInteger(value) {
  return /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value));
}

function isBoolean(value) {
  return /^(true|false)$/i.test(value);
}

function isUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_error) {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPort(value) {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);
  return port >= 1 && port <= 65535;
}

function isJson(value) {
  try {
    JSON.parse(value);
    return true;
  } catch (_error) {
    return false;
  }
}

function splitArgs(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseTypeSpec(type) {
  const match = /^([A-Za-z][A-Za-z0-9_-]*)(?:\((.*)\))?$/.exec(type);

  if (!match) {
    return { baseType: type, args: [], error: `Unknown schema type "${type}"` };
  }

  return {
    baseType: match[1],
    args: match[2] === undefined ? [] : splitArgs(match[2])
  };
}

function checkRange(value, baseType, args) {
  if (args.length === 0) {
    return null;
  }

  if (args.length !== 2 || args.some((arg) => !isNumber(arg))) {
    return `Invalid ${baseType} range`;
  }

  const number = Number(value);
  const [minimum, maximum] = args.map(Number);

  if (number < minimum || number > maximum) {
    return `Expected ${baseType} between ${minimum} and ${maximum}`;
  }

  return null;
}

function checkType(value, type) {
  const { baseType, args, error } = parseTypeSpec(type);

  if (error) {
    return error;
  }

  if (baseType === 'enum') {
    if (args.length === 0) {
      return 'Enum type requires at least one value';
    }

    return args.includes(value) ? null : `Expected one of: ${args.join(', ')}`;
  }

  if (!VALID_TYPES.has(baseType)) {
    return `Unknown schema type "${type}"`;
  }

  if (!['number', 'integer', 'float'].includes(baseType) && args.length > 0) {
    return `Type "${baseType}" does not accept arguments`;
  }

  if (baseType === 'string') {
    return null;
  }

  if (baseType === 'number' && !isNumber(value)) {
    return 'Expected a number';
  }

  if (baseType === 'boolean' && !isBoolean(value)) {
    return 'Expected true or false';
  }

  if (baseType === 'url' && !isUrl(value)) {
    return 'Expected a valid http(s) URL';
  }

  if (baseType === 'email' && !isEmail(value)) {
    return 'Expected a valid email address';
  }

  if (baseType === 'port' && !isPort(value)) {
    return 'Expected a port between 1 and 65535';
  }

  if (baseType === 'integer' && !isInteger(value)) {
    return 'Expected an integer';
  }

  if (baseType === 'float' && !isNumber(value)) {
    return 'Expected a float';
  }

  if (baseType === 'json' && !isJson(value)) {
    return 'Expected valid JSON';
  }

  if (['number', 'integer', 'float'].includes(baseType)) {
    return checkRange(value, baseType, args);
  }

  return null;
}

function validateKey(env, rule) {
  const value = env[rule.key];
  const present = Object.prototype.hasOwnProperty.call(env, rule.key);

  if (!present) {
    return {
      key: rule.key,
      type: rule.type,
      required: rule.required,
      value: undefined,
      pass: !rule.required,
      reason: rule.required ? 'Missing required key' : 'Optional key not set'
    };
  }

  if (isEmpty(value)) {
    return {
      key: rule.key,
      type: rule.type,
      required: rule.required,
      value,
      pass: false,
      reason: 'Value is empty'
    };
  }

  const typeError = checkType(value, rule.type);
  if (typeError) {
    return {
      key: rule.key,
      type: rule.type,
      required: rule.required,
      value,
      pass: false,
      reason: typeError
    };
  }

  if (rule.pattern && !rule.pattern.test(value)) {
    return {
      key: rule.key,
      type: rule.type,
      required: rule.required,
      value,
      pass: false,
      reason: `Does not match ${rule.pattern}`
    };
  }

  return {
    key: rule.key,
    type: rule.type,
    required: rule.required,
    value,
    pass: true,
    reason: 'OK'
  };
}

function validateCondition(env, condition) {
  const sourceValue = env[condition.sourceKey];

  if (sourceValue !== condition.expectedValue) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(env, condition.targetKey) && !isEmpty(env[condition.targetKey])) {
    return null;
  }

  return {
    key: condition.targetKey,
    type: 'conditional',
    required: true,
    value: undefined,
    pass: false,
    reason: condition.reason
  };
}

function validateStrict(env, schema) {
  return Object.keys(env)
    .filter((key) => !Object.prototype.hasOwnProperty.call(schema, key))
    .map((key) => ({
      key,
      type: 'unknown',
      required: false,
      value: undefined,
      pass: false,
      reason: 'Unknown key not in schema'
    }));
}

function validate(env, schema, options = {}) {
  const results = Object.values(schema).map((rule) => validateKey(env, rule));
  const conditions = schema.__conditions || [];

  conditions.forEach((condition) => {
    const result = validateCondition(env, condition);
    if (result) {
      results.push(result);
    }
  });

  if (options.strict) {
    results.push(...validateStrict(env, schema));
  }

  return results;
}

module.exports = {
  validate,
  validateKey,
  isEmpty,
  isNumber,
  isInteger,
  isBoolean,
  isUrl,
  isEmail,
  isPort,
  isJson,
  checkType
};
