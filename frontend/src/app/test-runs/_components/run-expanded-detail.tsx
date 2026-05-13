/**
 * Expanded detail row shown inline in the test runs list table.
 *
 * Fetches the full run data (including step results) on first expand
 * and displays a compact step table with case ID and completion time.
 */

"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TestRunDetail, StepResult } from "@/types/api";

interface RunExpandedDetailProps {
  /** Full run detail, or `undefined` while loading. */
  detail: TestRunDetail | undefined;
}

/**
 * Renders the inline detail view for an expanded test-run row.
 *
 * @param props.detail - The fully-loaded run object, or `undefined`.
 */
export function RunExpandedDetail({ detail }: RunExpandedDetailProps) {
  if (!detail) {
    return <p className="text-sm text-muted-foreground">Loading details...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Summary info */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Test Case ID: </span>
          <Link href={`/test-cases/${detail.testCaseId}/editor`} className="text-primary hover:underline">
            {detail.testCaseId?.slice(0, 8)}...
          </Link>
        </div>
        {detail.completedAt && (
          <div>
            <span className="text-muted-foreground">Completed: </span>
            {new Date(detail.completedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Step results sub-table */}
      {detail.stepResults?.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.stepResults.map((step: StepResult, idx: number) => (
                <TableRow key={step.id || idx}>
                  <TableCell className="text-xs">{step.stepOrder ?? idx + 1}</TableCell>
                  <TableCell className="text-xs font-mono">{step.blockType}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{step.description || step.target || "—"}</TableCell>
                  <TableCell><StatusBadge status={step.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {step.durationMs ? `${(step.durationMs / 1000).toFixed(2)}s` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                    {step.errorMessage || ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
