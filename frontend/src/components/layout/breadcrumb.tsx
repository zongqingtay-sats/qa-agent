/**
 * Breadcrumb context and component.
 *
 * Automatically generates breadcrumbs from the current URL path.
 * Pages can register human-readable names for dynamic segments (IDs)
 * via the context, so `/projects/abc123` shows "My Project" instead of "abc123".
 *
 * @module breadcrumb
 */

"use client";

import { createContext, useContext, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

/** Map of path segment → display label. Keys are the raw segment (e.g. "abc-123-def"). */
type SegmentLabels = Map<string, string>;

interface BreadcrumbContextValue {
  /** Register a label for a dynamic path segment (e.g. an entity ID). */
  setLabel: (segment: string, label: string) => void;
  /** Get the label for a segment, or undefined if not registered. */
  getLabel: (segment: string) => string | undefined;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  setLabel: () => {},
  getLabel: () => undefined,
});

/** Known static route labels. */
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

/**
 * Provider that holds entity name mappings for breadcrumb labels.
 * Wrap your layout with this.
 */
export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const labelsRef = useRef<SegmentLabels>(new Map());
  const listenersRef = useRef<Set<() => void>>(new Set());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const getSnapshot = useCallback(() => labelsRef.current, []);

  // Use external store so consumers re-render when labels change
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLabel = useCallback((segment: string, label: string) => {
    if (labelsRef.current.get(segment) !== label) {
      labelsRef.current.set(segment, label);
      listenersRef.current.forEach((l) => l());
    }
  }, []);

  const getLabel = useCallback((segment: string) => {
    return labelsRef.current.get(segment);
  }, []);

  const value = useMemo(() => ({ setLabel, getLabel }), [setLabel, getLabel]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/** Hook to register a label for a dynamic segment. Call in detail pages. */
export function useBreadcrumbLabel(segment: string | undefined, label: string | undefined) {
  const { setLabel } = useContext(BreadcrumbContext);
  // Register on every render (cheap no-op if unchanged)
  if (segment && label) {
    setLabel(segment, label);
  }
}

/** Hook to access the breadcrumb context. */
export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}

/**
 * Renders breadcrumbs automatically from the current URL path.
 * Resolves labels from static mapping first, then from registered entity names.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { getLabel } = useContext(BreadcrumbContext);

  const segments = pathname.split("/").filter(Boolean);

  // Don't show breadcrumbs on root/dashboard
  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = STATIC_LABELS[segment] || getLabel(segment) || segment;
    const isLast = index === segments.length - 1;
    return { label, href, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
      <Link href="/" className="hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {crumb.isLast ? (
            <span className="text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
