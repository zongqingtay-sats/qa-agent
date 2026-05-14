/**
 * Collapsible panel showing the most recent test run results inline
 * in the editor, displayed below the metadata section.
 *
 * - Collapsed: shows run ID (link), status badge, and error message if any.
 * - Expanded: shows run date, and the step result for the currently
 *   selected node (including screenshot).
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StepResult } from "@/types/api";

interface LastRunPanelProps {
  run: {
    id: string;
    status: string;
    startedAt: string;
    stepResults: StepResult[];
  };
  /** The currently selected node ID (to show its step result). */
  selectedNodeId?: string;
}

export function LastRunPanel({ run, selectedNodeId }: LastRunPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Find error message from the first failed step
  const failedStep = run.stepResults.find((s) => s.status === "failed" && !s.retry);
  const errorMessage = failedStep?.errorMessage;

  // Find step result for the currently selected node
  const selectedStep = selectedNodeId
    ? [...run.stepResults].reverse().find((s) => s.blockId === selectedNodeId && !s.retry)
    : null;

  return (
    <div className="border-b">
      {/* Collapsed header — always visible */}
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2.5 w-full justify-start rounded-none hover:bg-muted/50"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}

        <span className="text-sm font-medium">Last Run</span>

        <Link
          href={`/test-runs/${run.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
        >
          {run.id}
        </Link>

        <StatusBadge status={run.status} size="sm" />

        {/* Run metadata */}
        {expanded && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Date: {new Date(run.startedAt).toLocaleString()}</span>
            <span>Steps: {run.stepResults.filter((s) => !s.retry).length}</span>
          </div>
        )}
      </Button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Selected step detail */}
          {selectedStep ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium">
                  Step {selectedStep.stepOrder}: {selectedStep.description || selectedStep.blockType}
                </p>
                <StatusBadge status={selectedStep.status} size="sm" />
              </div>
              <div className="flex gap-4">
                <div>
                  {selectedStep.target && (
                    <p className="text-xs text-muted-foreground font-mono">Target: {selectedStep.target}</p>
                  )}
                  {selectedStep.expectedResult && (
                    <p className="text-xs text-muted-foreground">Expected: {selectedStep.expectedResult}</p>
                  )}
                  {selectedStep.actualResult && (
                    <p className="text-xs text-muted-foreground">Actual: {selectedStep.actualResult}</p>
                  )}
                  {selectedStep.errorMessage && (
                    <p className="text-xs text-red-600">Error: {selectedStep.errorMessage}</p>
                  )}
                  {selectedStep.durationMs != null && selectedStep.durationMs > 0 && (
                    <p className="text-xs text-muted-foreground">Duration: {selectedStep.durationMs}ms</p>
                  )}
                </div>
                {/* Screenshot */}
                {selectedStep.screenshotDataUrl && (
                  <div
                    className="ml-auto cursor-pointer"
                    onClick={() => window.open(selectedStep.screenshotDataUrl, "_blank")}
                  >
                    <img
                      src={selectedStep.screenshotDataUrl}
                      alt="Step screenshot"
                      className="rounded-md border max-h-16 w-full object-contain bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Select a block to view its step result.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
