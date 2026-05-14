/**
 * Test run detail page.
 *
 * Loads a single test run by ID, subscribes to real-time SSE updates
 * for live step results, and composes summary cards, case info, and
 * the step results table.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, RotateCcw, Play } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import type { TestRunDetail, StepResult } from "@/types/api";
import { runTestCase } from "@/lib/run-test";
import { useSSE, type SSEEvent } from "@/hooks/use-sse";
import { toast } from "sonner";

import { deriveExpectedSteps, mergeSteps } from "./_lib/merge-steps";
import { RunSummaryCards } from "./_components/run-summary-cards";
import { RunCaseInfo } from "./_components/run-case-info";
import { StepResultsTable } from "./_components/step-results-table";

export default function TestRunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<TestRunDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useBreadcrumbLabel(runId, run?.testCaseName || undefined);

  useEffect(() => { loadRun(); }, [runId]);

  async function loadRun() {
    try { setRun((await testRunsApi.get(runId)).data); }
    catch { /* API not available */ }
    finally { setLoading(false); }
  }

  // ── Real-time SSE updates ──

  useSSE({
    channels: ["test-runs"],
    onEvent: useCallback((event: SSEEvent) => {
      const data = event.data as unknown as TestRunDetail & { step?: StepResult };
      if (data?.id !== runId) return;

      if (event.type === "test-run:updated") {
        setRun((prev) => (prev ? { ...prev, ...data } : data as TestRunDetail));
      } else if (event.type === "test-run:step") {
        const step = data.step;
        if (!step) return;
        setRun((prev) => {
          if (!prev) return prev;
          const existing = prev.stepResults || [];
          const updated = [...existing];

          if (step.retry) {
            // Retry steps always appended to preserve history
            updated.push(step);
          } else {
            // Non-retry: upsert by id or stepOrder
            const idx = step.id
              ? existing.findIndex((s: StepResult) => s.id === step.id)
              : existing.findIndex((s: StepResult) => s.stepOrder === step.stepOrder && !s.retry);
            if (idx >= 0) updated[idx] = { ...updated[idx], ...step };
            else updated.push(step);
          }

          return {
            ...prev,
            stepResults: updated,
            totalSteps: data.totalSteps ?? prev.totalSteps,
            passedSteps: data.passedSteps ?? prev.passedSteps,
            failedSteps: data.failedSteps ?? prev.failedSteps,
          };
        });
      }
    }, [runId]),
  });

  // ── Action handlers ──

  async function handleExport(format: "json" | "docx" | "pdf") {
    try {
      const blob = await exportApi.testRun(runId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `test-run-${runId}.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRerun() {
    if (!run) return;
    try { await runTestCase(run.testCaseId); }
    catch (err: any) { toast.error(err.message || "Failed to re-run test"); }
  }

  // ── Loading / not-found states ──

  if (loading) {
    return (<><PageHeader title="Test Run Detail" /><div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div></>);
  }
  if (!run) {
    return (<><PageHeader title="Test Run Detail" /><div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Test run not found</p></div></>);
  }

  // ── Derive merged step list ──

  const expectedSteps = run.flowData ? deriveExpectedSteps(run.flowData) : [];
  const allSteps = mergeSteps(run.stepResults || [], expectedSteps);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Play className="h-5 w-5 shrink-0" />{run.testCaseName || "Test Run"}</span>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRerun}><RotateCcw className="h-4 w-4 mr-1" /> Re-run</Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("json")}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("docx")}>Export as DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <RunSummaryCards status={run.status} passedSteps={run.passedSteps} totalSteps={run.totalSteps} durationMs={run.durationMs ?? null} startedAt={run.startedAt} />
          {run.runByName && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                {run.runByName[0]?.toUpperCase() || "?"}
              </div>
              <span className="text-sm text-muted-foreground">Run by <span className="font-medium text-foreground">{run.runByName}</span></span>
            </div>
          )}
          <RunCaseInfo testCaseId={run.testCaseId} testCaseName={run.testCaseName} testCaseDescription={run.testCaseDescription} testCasePreconditions={run.testCasePreconditions} testCasePassingCriteria={run.testCasePassingCriteria} />
          <StepResultsTable steps={allSteps} />
        </div>
      </ScrollArea>
    </>
  );
}
