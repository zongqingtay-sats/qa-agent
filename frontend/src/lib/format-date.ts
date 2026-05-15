/**
 * Shared date/time formatting utility.
 *
 * - `formatRelative` — human-friendly relative time for lists (e.g. "just now", "5 mins ago")
 * - `formatDateTime` — precise format for detail pages: YYYY-MM-DD HH:MM:SS (24-hour)
 */

/**
 * Format a date as a human-friendly relative time string.
 * Used in lists, dashboards, and dropdown items.
 *
 * Examples: "just now", "2 mins ago", "3 hours ago", "yesterday", "5 days ago", "last week", "last month", "3 months ago", "last year"
 */
export function formatRelative(value: string | Date | undefined | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec} secs ago`;
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} mins ago`;
  if (diffHour === 1) return "1 hour ago";
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffWeek === 1) return "last week";
  if (diffDay < 30) return `${diffWeek} weeks ago`;
  if (diffMonth === 1) return "last month";
  if (diffMonth < 12) return `${diffMonth} months ago`;
  if (diffYear === 1) return "last year";
  return `${diffYear} years ago`;
}

/**
 * Format a date as YYYY-MM-DD HH:MM:SS (24-hour).
 * Used on detail pages (test case detail, run detail, campaign detail).
 */
export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

