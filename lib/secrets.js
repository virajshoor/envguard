function isProductionEnv(env) {
  return String(env.NODE_ENV || '').toLowerCase() === 'production';
}

function looksSensitiveKey(key) {
  return /(secret|token|password|passwd|pwd|private_key|api_key|access_key|jwt)/i.test(key);
}

function looksPlaceholder(value) {
  return /(change-?me|replace-?me|example|dummy|sample|placeholder|todo|your[_-]?|xxxx|password|secret|test_?key)/i.test(value);
}

function looksLocalhost(value) {
  return /(^|[/:@])(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(value);
}

function isTestCredential(value) {
  return /(?:^|[_-])test[_-]|sk_test_|pk_test_|rk_test_|test\./i.test(value);
}

function warning(key, reason) {
  return {
    key,
    type: 'secret-safety',
    required: false,
    value: undefined,
    pass: true,
    severity: 'warning',
    reason
  };
}

function secretWarnings(env) {
  const warnings = [];
  const production = isProductionEnv(env);

  Object.entries(env).forEach(([key, value]) => {
    const text = String(value || '').trim();

    if (!text) {
      return;
    }

    if (looksSensitiveKey(key) && looksPlaceholder(text)) {
      warnings.push(warning(key, 'Sensitive key looks like a placeholder'));
    }

    if (/JWT_SECRET/i.test(key) && text.length < 32) {
      warnings.push(warning(key, 'JWT secret should be at least 32 characters'));
    }

    if (looksSensitiveKey(key) && text.length < 12) {
      warnings.push(warning(key, 'Sensitive value looks unusually short'));
    }

    if (production && looksLocalhost(text)) {
      warnings.push(warning(key, 'Production value points at localhost'));
    }

    if (production && isTestCredential(text)) {
      warnings.push(warning(key, 'Production value looks like a test credential'));
    }
  });

  return warnings;
}

module.exports = {
  secretWarnings
};
