/**
 * Breadcrumb context and component.
 *
 * Uses a **hierarchy level** system to manage the navigation trail.
 * Each page has a level (lower number = higher in hierarchy).
 * When navigating to a page at level N, all trail entries with level >= N
 * are removed before the new entry is pushed. This ensures tabs replace
 * each other and deeper pages stack correctly.
 *
 * Pages register their label via `useBreadcrumbLabel`.
 *
 * @module breadcrumb
 */

"use client";

import { createContext, useContext, useCallback, useMemo, useRef, useEffect, useState, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single entry in the breadcrumb trail. */
export interface BreadcrumbEntry {
  path: string;
  label: string;
  level: number;
}

interface BreadcrumbContextValue {
  setCurrentLabel: (label: string) => void;
  getTrail: () => BreadcrumbEntry[];
  navigateTo: (index: number) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  setCurrentLabel: () => {},
  getTrail: () => [],
  navigateTo: () => {},
});

// ─── Session Storage ─────────────────────────────────────────────────────────

const SS_TRAIL_KEY = "breadcrumb_trail";
const SS_HISTORY_KEY = "breadcrumb_history";
const SS_LABELS_KEY = "breadcrumb_labels";
const MAX_HISTORY = 50;

function loadTrail(): BreadcrumbEntry[] {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SS_TRAIL_KEY) : null;
    if (raw) return JSON.parse(raw) as BreadcrumbEntry[];
  } catch { /* ignore */ }
  return [];
}

function saveTrail(trail: BreadcrumbEntry[]) {
  try { sessionStorage.setItem(SS_TRAIL_KEY, JSON.stringify(trail)); } catch { /* ignore */ }
}

/** Stack of previous trail states for browser-back restoration. */
function loadHistory(): BreadcrumbEntry[][] {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SS_HISTORY_KEY) : null;
    if (raw) return JSON.parse(raw) as BreadcrumbEntry[][];
  } catch { /* ignore */ }
  return [];
}

function saveHistory(history: BreadcrumbEntry[][]) {
  try { sessionStorage.setItem(SS_HISTORY_KEY, JSON.stringify(history)); } catch { /* ignore */ }
}

function loadLabelCache(): Map<string, string> {
  try {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SS_LABELS_KEY) : null;
    if (raw) return new Map(JSON.parse(raw) as [string, string][]);
  } catch { /* ignore */ }
  return new Map();
}

function saveLabelCache(cache: Map<string, string>) {
  try { sessionStorage.setItem(SS_LABELS_KEY, JSON.stringify(Array.from(cache.entries()))); } catch { /* ignore */ }
}

// ─── Static Labels ───────────────────────────────────────────────────────────

const STATIC_LABELS: Record<string, string> = {
  projects: "Projects",
  "test-cases": "Test Cases",
  "test-runs": "Test Runs",
  "campaign-runs": "Campaign Runs",
  campaigns: "Campaigns",
  cases: "Cases",
  runs: "Runs",
  generate: "Generate",
  settings: "Settings",
  admin: "Admin",
  users: "Users",
  roles: "Roles",
  profile: "Profile",
  setup: "Setup",
  editor: "Editor",
  import: "Import",
};

// ─── Level Computation ───────────────────────────────────────────────────────

/**
 * Determine the hierarchy level for a path.
 *
 * Level 1: Root/list pages (/projects, /settings, /test-cases, /test-runs, etc.)
 * Level 2: Project detail (/projects/[id])
 * Level 3: Project tabs (/projects/[id]/cases, /campaigns, /runs)
 * Level 4: Items under tabs (/projects/[id]/campaigns/[cid])
 * Level 5+: Deeper items
 *
 * For "detached" detail pages (/test-cases/[id], /test-runs/[id], /campaign-runs/[id]):
 * Returns -1 meaning "dynamic" — will be computed as maxTrailLevel + 1.
 */
function getFixedLevel(path: string): number | null {
  const segments = path.split("/").filter(Boolean);
  const len = segments.length;

  // 1 segment: root pages
  if (len <= 1) return 1;

  // Under /projects: level = segment count
  if (segments[0] === "projects") {
    return len;
  }

  // Editor sub-page: /test-cases/[id]/editor → dynamic
  // All other multi-segment non-project pages: dynamic
  return null;
}

function defaultLabelForPath(path: string, labelCache: Map<string, string>): string {
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return STATIC_LABELS[last] || labelCache.get(last) || last || "Home";
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const trailRef = useRef<BreadcrumbEntry[]>(loadTrail());
  const historyRef = useRef<BreadcrumbEntry[][]>(loadHistory());
  const labelCacheRef = useRef<Map<string, string>>(loadLabelCache());
  const [, forceRender] = useState(0);
  const lastPathnameRef = useRef<string | null>(null);
  const isPopStateRef = useRef(false);

  // Listen for popstate (browser back/forward)
  useEffect(() => {
    function handlePopState() {
      isPopStateRef.current = true;
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update trail synchronously during render
  if (lastPathnameRef.current !== pathname) {
    lastPathnameRef.current = pathname;

    // On page refresh, the trail already has this page as the last entry — skip
    const alreadyCurrent = trailRef.current.length > 0 && trailRef.current[trailRef.current.length - 1].path === pathname;

    if (isPopStateRef.current) {
      // ── Browser back: restore previous trail from history ──
      isPopStateRef.current = false;
      const history = historyRef.current;
      if (history.length > 0) {
        trailRef.current = history.pop()!;
        saveHistory(history);
      }
    } else if (alreadyCurrent) {
      // ── Page refresh or re-render with same path: no-op ──
    } else {
      // ── Forward navigation ──
      const trail = trailRef.current;
      const label = defaultLabelForPath(pathname, labelCacheRef.current);
      const fixedLevel = getFixedLevel(pathname);

      // Determine the level for this page
      let level: number;
      if (fixedLevel !== null) {
        level = fixedLevel;
      } else {
        // Dynamic: one deeper than current max
        const maxLevel = trail.length > 0 ? Math.max(...trail.map((e) => e.level)) : 0;
        level = maxLevel + 1;
      }

      // Save current trail to history (for browser back)
      historyRef.current.push([...trail]);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      saveHistory(historyRef.current);

      // Truncate: remove all entries with level >= this page's level
      const truncated = trail.filter((e) => e.level < level);
      truncated.push({ path: pathname, label, level });
      trailRef.current = truncated;
    }

    saveTrail(trailRef.current);
  }

  const setCurrentLabel = useCallback((label: string) => {
    const trail = trailRef.current;
    if (trail.length === 0) return;
    const entry = trail[trail.length - 1];
    if (entry.label !== label) {
      entry.label = label;
      saveTrail(trail);

      // Cache the label for future visits
      const segments = entry.path.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && !STATIC_LABELS[lastSegment]) {
        labelCacheRef.current.set(lastSegment, label);
        saveLabelCache(labelCacheRef.current);
      }

      forceRender((n) => n + 1);
    }
  }, []);

  const getTrail = useCallback(() => trailRef.current, []);

  const navigateTo = useCallback((index: number) => {
    const trail = trailRef.current;
    if (index < 0 || index >= trail.length) return;
    const target = trail[index];

    // Save current trail to history before truncating
    historyRef.current.push([...trail]);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    saveHistory(historyRef.current);

    trailRef.current = trail.slice(0, index + 1);
    saveTrail(trailRef.current);
    forceRender((n) => n + 1);
    router.push(target.path);
  }, [router]);

  const value = useMemo(() => ({ setCurrentLabel, getTrail, navigateTo }), [setCurrentLabel, getTrail, navigateTo]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Hook to register the current page's label in the breadcrumb trail.
 *
 * @param _segment - Unused legacy param. Pass the ID or undefined.
 * @param label - The display label for this page.
 */
export function useBreadcrumbLabel(_segment: string | undefined, label: string | undefined) {
  const { setCurrentLabel } = useContext(BreadcrumbContext);
  useEffect(() => {
    if (label) {
      setCurrentLabel(label);
    }
  }, [label, setCurrentLabel]);
}

/** Hook to access the breadcrumb context. */
export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}

// ─── Breadcrumb Component ────────────────────────────────────────────────────

function BreadcrumbsInner() {
  const { getTrail, navigateTo } = useContext(BreadcrumbContext);
  const trail = getTrail();

  if (trail.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
      <Link href="/" className="hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {trail.map((entry, i) => {
        if (i === 0 && entry.path === "/") return null;
        const isLast = i === trail.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="text-foreground">{entry.label}</span>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); navigateTo(i); }}
                className="hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 text-xs text-muted-foreground"
              >
                {entry.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function Breadcrumbs() {
  return (
    <Suspense fallback={null}>
      <BreadcrumbsInner />
    </Suspense>
  );
}
