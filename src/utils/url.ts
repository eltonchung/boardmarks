export function validUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('請輸入完整網址，例如 https://example.com');
  }
  if (!['http:', 'https:', 'ftp:', 'file:'].includes(url.protocol))
    throw new Error('僅支援 http、https、ftp 或 file 網址。');
  return url.href;
}
export function normalizeUrl(value: string): string {
  const url = new URL(validUrl(value));
  // Separate the suffix before trimming: a slash inside a query value or hash is significant.
  const suffix = url.search + url.hash;
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/+$/, '') + suffix;
}
export function isSaveable(url?: string): url is string {
  try {
    return !!url && !!validUrl(url);
  } catch {
    return false;
  }
}
export function duplicate<T extends { url: string }>(items: T[], url: string): T | undefined {
  const key = normalizeUrl(url);
  return items.find((item) => {
    try {
      return normalizeUrl(item.url) === key;
    } catch {
      return false;
    }
  });
}
