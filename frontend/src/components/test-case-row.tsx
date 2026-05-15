/**
 * Shared test case row component.
 *
 * A standardized row for displaying a test case anywhere in the app:
 * - Test cases list page
 * - Project cases page (group sections)
 * - Add test case dialogs (project & campaign)
 *
 * Supports an optional checkbox, status badge, assignee avatars,
 * last-run badge, tags, and configurable action buttons.
 */

"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import type { TestCase, ProjectTestCase, Assignment } from "@/types/api";
import { formatRelative, formatDateTime } from "@/lib/format-date";

export interface TestCaseRowAction {
  /** Unique key for React list rendering. */
  key: string;
  /** Icon to render inside the button. */
  icon: React.ReactNode;
  /** Tooltip / title. */
  title: string;
  /** Click handler. */
  onClick: () => void;
  /** Optional variant override. */
  variant?: "ghost" | "destructive";
  /** Optional extra className for the button. */
  className?: string;
}

export interface TestCaseRowProps {
  /** The test case data. Works with both TestCase and ProjectTestCase. */
  testCase: TestCase | ProjectTestCase;

  /** Whether a checkbox is shown. Default true. */
  showCheckbox?: boolean;
  /** Whether the row is currently selected (checked). */
  selected?: boolean;
  /** Called when the checkbox is toggled. */
  onToggleSelect?: (id: string) => void;

  /** Whether clicking the row navigates to the test case detail. Default true. */
  linkToDetail?: boolean;

  /** Whether to show status badge. Default true. */
  showStatus?: boolean;
  /** Whether to show last run status badge (if available). Default true. */
  showLastRunStatus?: boolean;
  /** Whether to show assignee avatars (if available). Default true. */
  showAvatars?: boolean;
  /** Whether to show tags. Default false. */
  showTags?: boolean;
  /** Whether to show the updated-at date. Default false. */
  showUpdatedAt?: boolean;

  /** Action buttons to render on the right side. */
  actions?: TestCaseRowAction[];

  /** Optional extra content/slot rendered after the name. */
  children?: React.ReactNode;
}

/**
 * A single test case row with standardized layout across all list views.
 */
export function TestCaseRow({
  testCase,
  showCheckbox = true,
  selected = false,
  onToggleSelect,
  linkToDetail = true,
  showStatus = true,
  showLastRunStatus = true,
  showAvatars = true,
  showTags = false,
  showUpdatedAt = false,
  actions,
  children,
}: TestCaseRowProps) {
  const tc = testCase as ProjectTestCase;
  const assignments: Assignment[] | undefined = (tc as any).assignments;
  const lastRunStatus: string | null | undefined = (tc as any).lastRunStatus;

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 group">
      {/* Checkbox */}
      {showCheckbox && (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            className="cursor-pointer bg-background"
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(testCase.id)}
          />
        </div>
      )}

      {/* Name (optionally linked) */}
      {linkToDetail ? (
        <Link
          href={`/test-cases/${testCase.id}`}
          className="flex-1 text-sm font-medium truncate hover:underline"
        >
          {testCase.name}
        </Link>
      ) : (
        <span className="flex-1 text-sm font-medium truncate">
          {testCase.name}
        </span>
      )}

      {/* Children slot */}
      {children}

      {/* Tags */}
      {showTags && testCase.tags && testCase.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap shrink-0">
          {testCase.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Updated at */}
      {showUpdatedAt && (
        <span className="text-xs text-muted-foreground shrink-0" title={formatDateTime(testCase.updatedAt)}>
          {formatRelative(testCase.updatedAt)}
        </span>
      )}

      {/* Assignee avatars */}
      {showAvatars && assignments && assignments.length > 0 && (
        <div className="flex -space-x-2 shrink-0">
          {assignments.slice(0, 3).map((a, i) => (
            <div
              key={i}
              className={`h-6 w-6 rounded-full text-xs flex items-center justify-center border-2 border-background ${!a.avatarBg ? "bg-primary text-primary-foreground" : ""}`}
              style={a.avatarBg ? { backgroundColor: a.avatarBg, color: "#fff" } : undefined}
              title={a.userName || a.userId}
            >
              {a.avatarText || (a.userName || a.userId)?.[0]?.toUpperCase() || "?"}
            </div>
          ))}
          {assignments.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center border-2 border-background">
              +{assignments.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Last run status */}
      {showLastRunStatus && lastRunStatus && (
        <StatusBadge status={lastRunStatus} size="sm" />
      )}

      {/* Status */}
      {showStatus && (
        <StatusBadge status={testCase.status} size="sm" />
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {actions.map((action) => (
            <Button
              key={action.key}
              variant={action.variant || "ghost"}
              size="icon"
              className={`h-7 w-7 ${action.className || ""}`}
              title={action.title}
              onClick={action.onClick}
            >
              {action.icon}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
