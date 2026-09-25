const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_PATTERN = /^[1-9]\d{0,18}$/;

export function isResourceId(value: string): boolean {
  return UUID_PATTERN.test(value) || NUMERIC_PATTERN.test(value);
}
