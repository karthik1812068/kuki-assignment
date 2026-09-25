const SENSITIVE_KEY =
  /(password|secret|token|api[-_]?key|authorization|cookie|credential|encryption[-_]?key)/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitive(nested);
    }
    return output;
  }

  return value;
}
