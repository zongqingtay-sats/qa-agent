/**
 * Renders a list of test case rows inside a project group section.
 *
 * Each row shows the test case name (as a link), assignee avatars,
 * last-run status badge, and current status badge. A checkbox allows
 * selecting test cases for bulk operations.
 *
 * @param props.items        - Test cases to render.
 * @param props.selected     - Set of currently selected test case IDs.
 * @param props.toggleSelect - Callback to toggle a single test case's selection.
 */

"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ProjectTestCase, Assignment } from "@/types/api";

interface TestCaseRowsProps {
  items: ProjectTestCase[];
  selected: Set<string>;
  toggleSelect: (id: string) => void;
}

export function TestCaseRows({ items, selected, toggleSelect }: TestCaseRowsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No test cases</p>;
  }

  return (
    <div className="space-y-1">
      {items.map((tc) => (
        <div
          key={tc.id}
          className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-muted/50"
        >
          <Checkbox
            checked={selected.has(tc.id)}
            onCheckedChange={() => toggleSelect(tc.id)}
          />
          <Link
            href={`/test-cases/${tc.id}`}
            className="flex-1 text-sm font-medium truncate"
          >
            {tc.name}
          </Link>

          {/* Assignee avatars (max 3, then "+N" overflow) */}
          {tc.assignments && tc.assignments.length > 0 && (
            <div className="flex -space-x-2">
              {tc.assignments.slice(0, 3).map((a: Assignment, i: number) => (
                <div
                  key={i}
                  className={`h-6 w-6 rounded-full text-xs flex items-center justify-center border-2 border-background ${!a.avatarBg ? "bg-primary text-primary-foreground" : ""}`}
                  style={a.avatarBg ? { backgroundColor: a.avatarBg, color: "#fff" } : undefined}
                  title={a.userName || a.userId}
                >
                  {a.avatarText || (a.userName || a.userId)?.[0]?.toUpperCase() || "?"}
                </div>
              ))}
              {tc.assignments.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center border-2 border-background">
                  +{tc.assignments.length - 3}
                </div>
              )}
            </div>
          )}

          {tc.lastRunStatus && <StatusBadge status={tc.lastRunStatus} size="sm" />}
          <StatusBadge status={tc.status} size="sm" />
        </div>
      ))}
    </div>
  );
}
