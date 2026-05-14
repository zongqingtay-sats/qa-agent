/**
 * Test run list table component.
 *
 * Renders all test runs in a table with checkboxes, expandable inline
 * details, re-run / export actions, and step count progress.
 */

"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { RunExpandedDetail } from "./run-expanded-detail";
import type { TestRunListItem, TestRunDetail } from "@/types/api";

interface TestRunTableProps {
  /** The list of test runs to display. */
  testRuns: TestRunListItem[];
  /** Whether data is still loading. */
  loading: boolean;
  /** Whether the list is filtered (for empty-state messaging). */
  hasSearch: boolean;
  /** Set of currently selected test run IDs. */
  selected: Set<string>;
  /** Set of currently expanded test run IDs. */
  expanded: Set<string>;
  /** Lazy-loaded detail data keyed by run ID. */
  runDetails: Record<string, TestRunDetail>;
  /** Toggle one row's selection. */
  onToggleSelect: (id: string) => void;
  /** Toggle all rows. */
  onToggleSelectAll: () => void;
  /** Toggle expansion for a row. */
  onToggleExpand: (id: string) => void;
  /** Re-run a test run. */
  onRetry: (run: TestRunListItem) => void;
  /** Export a single test run. */
  onExport: (id: string, format: "json" | "docx" | "pdf") => void;
}

export function TestRunTable({
  testRuns,
  loading,
  hasSearch,
  selected,
  expanded,
  runDetails,
  onToggleSelect,
  onToggleSelectAll,
  onToggleExpand,
  onRetry,
  onExport,
}: TestRunTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-md ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><Checkbox checked={testRuns.length > 0 && selected.size === testRuns.length} onCheckedChange={onToggleSelectAll} /></TableHead>
            <TableHead className="w-8"></TableHead>
            <TableHead>Test Case</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Steps</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Run By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
          ) : testRuns.length === 0 ? (
            <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
              {hasSearch ? "No test runs match your search." : "No test runs yet. Run a test case to see results here."}
            </TableCell></TableRow>
          ) : (
            testRuns.map((run) => (
              <Fragment key={run.id}>
                <TableRow className="cursor-pointer" onClick={() => router.push(`/test-runs/${run.id}`)}>
                  <TableCell><Checkbox checked={selected.has(run.id)} onCheckedChange={() => onToggleSelect(run.id)} /></TableCell>
                  <TableCell className="align-middle">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { onToggleExpand(run.id); e.stopPropagation(); }}>
                      {expanded.has(run.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{run.testCaseName}</TableCell>
                  <TableCell><StatusBadge status={run.status} /></TableCell>
                  <TableCell className="text-sm">
                    <span className="text-green-600">{run.passedSteps}</span> / <span>{run.totalSteps}</span>
                    {run.failedSteps > 0 && <span className="text-red-600 ml-1">({run.failedSteps} failed)</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}</TableCell>
                  <TableCell>
                    {run.runByName ? (
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center" title={run.runByName}>
                        {run.runByName[0]?.toUpperCase() || "?"}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Re-run" onClick={(e) => { e.stopPropagation(); onRetry(run); }}><RotateCcw className="h-3 w-3" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" title="Export"><Download className="h-3 w-3" /></Button>} />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onExport(run.id, "json")}>Export as JSON</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onExport(run.id, "docx")}>Export as DOCX</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onExport(run.id, "pdf")}>Export as PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(run.id) && (
                  <TableRow className="bg-muted/30 hover:bg-muted/50">
                    <TableCell colSpan={9} className="p-0">
                      <div className="px-6 py-4"><RunExpandedDetail detail={runDetails[run.id]} /></div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
