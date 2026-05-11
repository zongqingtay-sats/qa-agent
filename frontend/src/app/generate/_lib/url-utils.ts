/**
 * URL inference and formatting utilities for the generate page.
 *
 * Used to extract or auto-correct target URLs from user-provided
 * natural language descriptions.
 */

/**
 * Attempt to extract a URL from free-form text.
 *
 * Checks for explicit `http(s)://` URLs first, then bare domain names
 * (e.g. `example.com/path`), then `localhost` references.
 *
 * @param text - The raw text to scan.
 * @returns The best-guess URL, or `""` if nothing matched.
 */
export function inferUrlFromText(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s,)]+/i);
  if (urlMatch) return urlMatch[0];

  const domainMatch = text.match(
    /(?:^|\s)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?)/i
  );
  if (domainMatch) return `https://${domainMatch[1]}`;

  const localhostMatch = text.match(/localhost(?::(\d+))?(?:\/[^\s,)]*)?/i);
  if (localhostMatch) return `http://${localhostMatch[0]}`;

  return "";
}

/**
 * Normalise a URL string by prepending a scheme if missing.
 *
 * Localhost URLs get `http://`, everything else gets `https://`.
 *
 * @param raw - The raw URL input value.
 * @returns The normalised URL, or the original if already valid.
 */
export function formatUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^localhost(:|$)/i.test(v)) return `http://${v}`;
  return `https://${v}`;
}
