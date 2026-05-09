export type Theme = "light" | "dark" | "system";

const THEME_KEY = "qa-agent-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

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
