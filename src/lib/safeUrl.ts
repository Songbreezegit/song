// Control characters and backslashes can alter browser URL parsing.
// eslint-disable-next-line no-control-regex
const controls = /[\u0000-\u001f\u007f\\]/;

export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || controls.test(value)) return undefined;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || controls.test(value)) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  return safeExternalUrl(trimmed);
}

export function safeMailto(value: unknown): string | undefined {
  return typeof value === 'string' && /^[^\s<>?&#;:"\\]+@[^\s<>?&#;:"\\]+\.[^\s<>?&#;:"\\]+$/.test(value)
    ? `mailto:${value}` : undefined;
}
