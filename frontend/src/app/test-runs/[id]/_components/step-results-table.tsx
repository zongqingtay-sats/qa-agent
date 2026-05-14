/**
 * Step results table for the test-run detail page.
 *
 * Renders every step (executed or expected-but-unexecuted) with
 * expandable detail rows showing selector, expected/actual values,
 * error messages, and screenshots.
 */

"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, CircleDashed, Image as ImageIcon, RefreshCw } from "lucide-react";
import type { StepResult } from "@/types/api";

interface StepResultsTableProps {
  /** Merged step list (executed + unexecuted placeholders). */
  steps: (StepResult & { _unexecuted?: boolean })[];
}

/**
 * Renders an interactive, expandable table of step results.
 *
 * - Unexecuted steps are shown faded with a "Not executed" label.
 * - Retry steps display a small ↻ icon next to the step number.
 * - Clicking a row toggles an expanded detail section.
 *
 * @param props.steps - The merged step list from `mergeSteps()`.
 */
export function StepResultsTable({ steps }: StepResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /** Toggle expanded state for a step row. */
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Screenshot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step: any, idx: number) => {
              const stepId = step.id || `step-${step.stepOrder}-${idx}`;
              const isExpanded = expanded.has(stepId);
              const isUnexecuted = step._unexecuted;

              return (
                <Fragment key={stepId}>
                  {/* Main step row */}
                  <TableRow
                    className={
                      isUnexecuted ? "opacity-50" :
                      step.status === "failed" ? "bg-red-50" :
                      step.status === "running" ? "bg-blue-50/50 animate-pulse" : ""
                    }
                  >
                    <TableCell className="align-middle">
                      {!isUnexecuted ? (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggle(stepId)}>
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <span className="flex items-center gap-1" title={step.retry ? "Retry step" : ""}>
                        {step.stepOrder}
                        {step.retry && <RefreshCw className="h-2.5 w-2.5" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">{step.blockType}</Badge>
                        {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isUnexecuted
                        ? <span className="text-xs text-muted-foreground italic">Not executed</span>
                        : <StatusBadge status={step.status} />}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {!isUnexecuted && step.durationMs ? `${step.durationMs}ms` : "—"}
                    </TableCell>
                    <TableCell>
                      {step.screenshotDataUrl ? (
                        <Dialog>
                          <DialogTrigger render={<Button variant="ghost" />}>
                            <ImageIcon className="h-4 w-4 mr-1" /> View
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl">
                            <DialogTitle>Step {step.stepOrder} Screenshot</DialogTitle>
                            <img src={step.screenshotDataUrl} alt={`Step ${step.stepOrder} screenshot`} className="w-full rounded border" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {isExpanded && !isUnexecuted && (
                    <TableRow className="bg-muted/30 hover:bg-muted/50">
                      <TableCell colSpan={6} className="p-0">
                        <div className="px-6 py-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Target / Selector</p>
                              <p className="font-mono text-xs bg-muted rounded px-2 py-1 break-all">{step.target || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Block Type</p>
                              <p className="text-xs">{step.blockType}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Expected Result</p>
                              <p className="text-xs break-all">{step.expectedResult || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Actual Result</p>
                              <p className="text-xs break-all">{step.actualResult || "—"}</p>
                            </div>
                          </div>
                          {step.errorMessage && (
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Error</p>
                              <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 break-all">{step.errorMessage}</p>
                            </div>
                          )}
                          {step.screenshotDataUrl && (
                            <div>
                              <p className="text-muted-foreground text-xs font-semibold mb-1">Screenshot</p>
                              <img src={step.screenshotDataUrl} alt={`Step ${step.stepOrder} screenshot`} className="rounded border max-h-64 object-contain" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {steps.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No step results recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
