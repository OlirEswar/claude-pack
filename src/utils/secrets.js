// Keys whose values should always be redacted
const SECRET_KEY_PATTERNS = [
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /access[_-]?token/i,
  /secret[_-]?key/i,
  /private[_-]?key/i,
  /auth[_-]?token/i,
  /bearer/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /_token$/i,
  /_secret$/i,
  /_key$/i,
];

// Value patterns that look like secrets regardless of key name
const SECRET_VALUE_PATTERNS = [
  /^sk-[a-zA-Z0-9]{20,}/,         // Anthropic / OpenAI style
  /^ghp_[a-zA-Z0-9]{36}/,         // GitHub personal access token
  /^ghs_[a-zA-Z0-9]{36}/,         // GitHub server token
  /^github_pat_[a-zA-Z0-9_]{82}/, // GitHub fine-grained PAT
  /^xoxb-/,                        // Slack bot token
  /^xoxp-/,                        // Slack user token
  /^AKIA[0-9A-Z]{16}/,            // AWS access key
];

/**
 * Recursively strips secret-looking values from an object.
 * Special case: all values inside an `env` object are redacted
 * since MCP server env vars typically contain credentials.
 *
 * @returns {{ result: object, warnings: string[] }}
 */
export function stripSecrets(obj, path = '', insideEnv = false) {
  if (typeof obj !== 'object' || obj === null) {
    return { result: obj, warnings: [] };
  }

  if (Array.isArray(obj)) {
    return { result: obj, warnings: [] };
  }

  const stripped = {};
  const warnings = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const isEnvObject = key === 'env' && typeof value === 'object' && !Array.isArray(value);
    const isSecretKey = SECRET_KEY_PATTERNS.some((p) => p.test(key));
    const isSecretValue =
      typeof value === 'string' && SECRET_VALUE_PATTERNS.some((p) => p.test(value));

    if (insideEnv && typeof value === 'string') {
      // All string values inside an env block are credentials
      stripped[key] = '<REDACTED>';
      warnings.push(currentPath);
    } else if ((isSecretKey || isSecretValue) && typeof value === 'string') {
      stripped[key] = '<REDACTED>';
      warnings.push(currentPath);
    } else if (typeof value === 'object' && value !== null) {
      const { result, warnings: childWarnings } = stripSecrets(
        value,
        currentPath,
        isEnvObject,
      );
      stripped[key] = result;
      warnings.push(...childWarnings);
    } else {
      stripped[key] = value;
    }
  }

  return { result: stripped, warnings };
}
