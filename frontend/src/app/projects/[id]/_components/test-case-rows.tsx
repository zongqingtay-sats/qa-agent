/**
 * Renders a list of test case rows inside a project group section.
 *
 * Uses the shared TestCaseRow component for consistent styling.
 */

"use client";

import { TestCaseRow } from "@/components/test-case-row";
import type { ProjectTestCase } from "@/types/api";

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
        <TestCaseRow
          key={tc.id}
          testCase={tc}
          selected={selected.has(tc.id)}
          onToggleSelect={toggleSelect}
          showStatus
          showLastRunStatus
          showAvatars
        />
      ))}
    </div>
  );
}
