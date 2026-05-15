/**
 * Test case list table component.
 *
 * Renders all test cases using the shared TestCaseRow component with
 * checkboxes, inline actions (run, delete, export), tags, and status badges.
 */

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { TestCaseRow, type TestCaseRowAction } from "@/components/test-case-row";
import { Play, Trash2, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { TestCase } from "@/types/api";

interface TestCaseTableProps {
  /** The list of test cases to display. */
  testCases: TestCase[];
  /** Whether data is still loading. */
  loading: boolean;
  /** Set of currently selected test case IDs. */
  selected: Set<string>;
  /** Toggle one row's selection. */
  onToggleSelect: (id: string) => void;
  /** Toggle all rows. */
  onToggleSelectAll: () => void;
  /** Run a single test case. */
  onRun: (id: string) => void;
  /** Delete a single test case. */
  onDelete: (id: string) => void;
  /** Export a single test case. */
  onExport: (id: string, format: "json" | "docx" | "pdf") => void;
}

/**
 * Renders the main test-cases list with per-row actions.
 */
export function TestCaseTable({
  testCases, loading, selected,
  onToggleSelect, onToggleSelectAll,
  onRun, onDelete, onExport,
}: TestCaseTableProps) {
  return (
    <div className="rounded-md ring-1 ring-foreground/10">
      {/* Header */}
      <div className="flex items-center gap-3 py-2 px-2 border-b text-sm text-muted-foreground font-medium">
        <div className="w-6">
          <Checkbox
            checked={testCases.length > 0 && selected.size === testCases.length}
            onCheckedChange={onToggleSelectAll}
          />
        </div>
        <div className="flex-1">Name</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-28 text-right">Actions</div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : testCases.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No test cases found. Create one or import from a document.
        </div>
      ) : (
        <div className="divide-y">
          {testCases.map((tc) => (
            <TestCaseRow
              key={tc.id}
              testCase={tc}
              selected={selected.has(tc.id)}
              onToggleSelect={onToggleSelect}
              showStatus
              showTags
              showUpdatedAt
              showAvatars={false}
              showLastRunStatus={false}
              actions={[
                { key: "run", icon: <Play className="h-3 w-3" />, title: "Run", onClick: () => onRun(tc.id) },
                { key: "delete", icon: <Trash2 className="h-3 w-3" />, title: "Delete", onClick: () => onDelete(tc.id), className: "text-destructive" },
              ]}
            >
              <ExportDropdown onExport={(format) => onExport(tc.id, format)} />
            </TestCaseRow>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportDropdown({ onExport }: { onExport: (format: "json" | "docx" | "pdf") => void }) {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Export"><Download className="h-3 w-3" /></Button>
        } />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("json")}>Export as JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("docx")}>Export as DOCX</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("pdf")}>Export as PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
