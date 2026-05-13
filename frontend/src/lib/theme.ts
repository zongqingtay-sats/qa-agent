/**
 * Theme management helpers for light / dark / system mode.
 *
 * Persists the user's choice to `localStorage` and applies it by toggling
 * the `light` / `dark` class on `<html>`.
 *
 * @module theme
 */

/** Supported colour-scheme modes. */
export type Theme = "light" | "dark" | "system";

/** LocalStorage key for the persisted theme preference. */
const THEME_KEY = "qa-agent-theme";

/**
 * Read the persisted theme from localStorage.
 *
 * @returns The stored theme, or `"system"` if none is set.
 */
export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

/**
 * Persist the chosen theme and apply it to the document.
 *
 * @param theme - The theme to store and activate.
 */
export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply a theme to the document root element.
 *
 * Adds or removes `light` / `dark` classes on `<html>`.
 * When `"system"` is used, no class is added so the browser's
 * `prefers-color-scheme` media query takes effect.
 *
 * @param theme - Theme to apply; defaults to the persisted value.
 */
export function applyTheme(theme?: Theme) {
  if (typeof window === "undefined") return;
  const t = theme || getTheme();
  const root = document.documentElement;

  root.classList.remove("light", "dark");

  if (t === "light") {
    root.classList.add("light");
  } else if (t === "dark") {
    root.classList.add("dark");
  }
  // "system" — no class added, falls back to @media (prefers-color-scheme)
}
