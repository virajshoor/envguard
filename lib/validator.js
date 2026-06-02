const VALID_TYPES = new Set(['string', 'number', 'boolean', 'url', 'email', 'port']);

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isNumber(value) {
  return /^-?(?:\d+|\d*\.\d+)$/.test(value) && Number.isFinite(Number(value));
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

function checkType(value, type) {
  if (!VALID_TYPES.has(type)) {
    return `Unknown schema type "${type}"`;
  }

  if (type === 'string') {
    return null;
  }

  if (type === 'number' && !isNumber(value)) {
    return 'Expected a number';
  }

  if (type === 'boolean' && !isBoolean(value)) {
    return 'Expected true or false';
  }

  if (type === 'url' && !isUrl(value)) {
    return 'Expected a valid http(s) URL';
  }

  if (type === 'email' && !isEmail(value)) {
    return 'Expected a valid email address';
  }

  if (type === 'port' && !isPort(value)) {
    return 'Expected a port between 1 and 65535';
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

function validate(env, schema) {
  return Object.values(schema).map((rule) => validateKey(env, rule));
}

module.exports = {
  validate,
  validateKey,
  isEmpty,
  isNumber,
  isBoolean,
  isUrl,
  isEmail,
  isPort
};
