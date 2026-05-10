"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Image as ImageIcon, ChevronDown, ChevronRight, ExternalLink, RotateCcw, RefreshCw, CircleDashed } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";
import Link from "next/link";

export default function TestRunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  function toggleStepExpand(stepId: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  useEffect(() => {
    loadRun();
  }, [runId]);

  // Real-time updates via SSE
  useSSE({
    channels: ["test-runs"],
    onEvent: useCallback((event: any) => {
      if (event.data?.id !== runId) return;

      if (event.type === "test-run:updated") {
        // Full test-run update (e.g. status change, completion)
        setRun((prev: any) => prev ? { ...prev, ...event.data } : event.data);
      } else if (event.type === "test-run:step") {
        // Real-time step result — upsert into the stepResults array
        const step = event.data.step;
        if (!step) return;
        setRun((prev: any) => {
          if (!prev) return prev;
          const existing = prev.stepResults || [];
          // Find by stepOrder — replace if exists, append if new
          const idx = existing.findIndex((s: any) => s.stepOrder === step.stepOrder);
          const updated = [...existing];
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], ...step };
          } else {
            updated.push(step);
          }
          return {
            ...prev,
            stepResults: updated,
            totalSteps: event.data.totalSteps ?? prev.totalSteps,
            passedSteps: event.data.passedSteps ?? prev.passedSteps,
            failedSteps: event.data.failedSteps ?? prev.failedSteps,
          };
        });
      }
    }, [runId]),
  });

  async function loadRun() {
    try {
      const res = await testRunsApi.get(runId);
      setRun(res.data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'json' | 'docx' | 'pdf') {
    try {
      const blob = await exportApi.testRun(runId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-run-${runId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRerun() {
    if (!run) return;
    try {
      await runTestCase(run.testCaseId);
    } catch (err: any) {
      toast.error(err.message || "Failed to re-run test");
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Test Run Detail" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  if (!run) {
    return (
      <>
        <PageHeader title="Test Run Detail" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Test run not found</p>
        </div>
      </>
    );
  }

  const statusColor = run.status === 'passed' ? 'text-green-600' : run.status === 'failed' ? 'text-red-600' : 'text-blue-600';

  // Derive expected steps from flow data via BFS (mirrors extension logic)
  const allSteps = (() => {
    const executedSteps: any[] = run.stepResults || [];

    // Parse flow data to get the full expected step list
    let expectedSteps: { blockId: string; blockType: string; description: string; target?: string }[] = [];
    try {
      const flow = typeof run.flowData === 'string' ? JSON.parse(run.flowData) : run.flowData;
      if (flow?.nodes && flow?.edges) {
        const nodeMap = new Map(flow.nodes.map((n: any) => [n.id, n]));
        const adjacency = new Map<string, string[]>();
        flow.edges.forEach((e: any) => {
          if (!adjacency.has(e.source)) adjacency.set(e.source, []);
          adjacency.get(e.source)!.push(e.target);
        });
        const startNode = flow.nodes.find((n: any) => n.data?.blockType === 'start');
        if (startNode) {
          const visited = new Set<string>();
          const queue = [startNode.id];
          while (queue.length > 0) {
            const id = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);
            const node = nodeMap.get(id) as any;
            if (node) {
              const d = node.data || {};
              if (d.blockType !== 'start' && d.blockType !== 'end') {
                expectedSteps.push({
                  blockId: node.id,
                  blockType: d.blockType,
                  description: d.label || d.description || d.blockType,
                  target: d.selector || d.url,
                });
              }
            }
            const targets = adjacency.get(id) || [];
            targets.forEach((t: string) => { if (!visited.has(t)) queue.push(t); });
          }
        }
      }
    } catch {
      // Can't parse flow data — just show executed steps
    }

    if (expectedSteps.length === 0) return executedSteps;

    // Build merged list: for each expected step, find matching executed results
    // Retry steps are additional records with the same blockId
    const merged: any[] = [];
    const usedExecutedIds = new Set<string>();

    expectedSteps.forEach((expected, idx) => {
      const stepOrder = idx + 1;
      // Find all executed results for this step order (including retries)
      const matches = executedSteps.filter((s: any) => {
        // Match by blockId (most reliable) or stepOrder
        return s.blockId === expected.blockId || (!s.blockId && s.stepOrder === stepOrder);
      });

      if (matches.length === 0) {
        // Unexecuted step
        merged.push({
          stepOrder,
          blockId: expected.blockId,
          blockType: expected.blockType,
          description: expected.description,
          target: expected.target,
          status: 'skipped',
          _unexecuted: true,
        });
      } else {
        matches.forEach((m: any) => {
          usedExecutedIds.add(m.id || `${m.stepOrder}-${m.retry}`);
          merged.push({ ...m, stepOrder: m.stepOrder || stepOrder });
        });
      }
    });

    // Append any executed steps that didn't match (edge case)
    executedSteps.forEach((s: any) => {
      const id = s.id || `${s.stepOrder}-${s.retry}`;
      if (!usedExecutedIds.has(id)) {
        merged.push(s);
      }
    });

    return merged;
  })();

  return (
    <>
      <PageHeader
        title={run.testCaseName || "Test Run"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRerun}>
              <RotateCcw className="h-4 w-4 mr-1" /> Re-run
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('json')}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>Export as DOCX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        }
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${statusColor}`}>{run.status.toUpperCase()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">
                  <span className="text-green-600">{run.passedSteps}</span>
                  <span className="text-muted-foreground"> / {run.totalSteps}</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">
                  {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{new Date(run.startedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Test Case Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Case Info</CardTitle>
                <Link href={`/test-cases/${run.testCaseId}/editor`}>
                  <Button variant="outline">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Test Case
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold mb-1">Name</p>
                  <p>{run.testCaseName || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-semibold mb-1">Case ID</p>
                  <Link href={`/test-cases/${run.testCaseId}/editor`} className="text-primary hover:underline font-mono text-xs">
                    {run.testCaseId}
                  </Link>
                </div>
                {run.testCaseDescription && (
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs font-semibold mb-1">Description</p>
                    <p className="text-muted-foreground">{run.testCaseDescription}</p>
                  </div>
                )}
                {run.testCasePreconditions && (
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs font-semibold mb-1">Preconditions</p>
                    <p className="text-muted-foreground">{run.testCasePreconditions}</p>
                  </div>
                )}
                {run.testCasePassingCriteria && (
                  <div className="md:col-span-2">
                    <p className="text-muted-foreground text-xs font-semibold mb-1">Passing Criteria</p>
                    <p className="text-muted-foreground">{run.testCasePassingCriteria}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step Results */}
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
                  {allSteps.map((step: any, idx: number) => {
                    const stepId = step.id || `step-${step.stepOrder}-${idx}`;
                    const isExpanded = expandedSteps.has(stepId);
                    const isUnexecuted = step._unexecuted;
                    return (
                      <Fragment key={stepId}>
                        <TableRow
                          key={stepId}
                          className={
                            isUnexecuted ? 'opacity-50' :
                            step.status === 'failed' ? 'bg-red-50' :
                            step.status === 'running' ? 'bg-blue-50/50 animate-pulse' : ''
                          }
                        >
                          <TableCell className="align-middle">
                            {!isUnexecuted ? (
                              <button type="button" onClick={() => toggleStepExpand(stepId)} className="cursor-pointer flex items-center justify-center">
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              </button>
                            ) : (
                              <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/50" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <span className="flex items-center gap-1">
                              {step.stepOrder}
                              {step.retry && (
                                <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 gap-0.5">
                                  <RefreshCw className="h-2.5 w-2.5" /> retry
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <Badge variant="outline" className="text-xs mb-1">{step.blockType}</Badge>
                              {step.description && (
                                <p className="text-xs text-muted-foreground">{step.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isUnexecuted ? (
                              <span className="text-xs text-muted-foreground italic">Not executed</span>
                            ) : (
                              <StatusBadge status={step.status} />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {!isUnexecuted && step.durationMs ? `${step.durationMs}ms` : '—'}
                          </TableCell>
                          <TableCell>
                            {step.screenshotDataUrl ? (
                              <Dialog>
                                <DialogTrigger render={<Button variant="ghost" />}>
                                    <ImageIcon className="h-4 w-4 mr-1" /> View
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                  <DialogTitle>Step {step.stepOrder} Screenshot</DialogTitle>
                                  <img
                                    src={step.screenshotDataUrl}
                                    alt={`Step ${step.stepOrder} screenshot`}
                                    className="w-full rounded border"
                                  />
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && !isUnexecuted && (
                          <TableRow key={`${stepId}-detail`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              <div className="px-6 py-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground text-xs font-semibold mb-1">Target / Selector</p>
                                    <p className="font-mono text-xs bg-muted rounded px-2 py-1 break-all">{step.target || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs font-semibold mb-1">Block Type</p>
                                    <p className="text-xs">{step.blockType}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs font-semibold mb-1">Expected Result</p>
                                    <p className="text-xs break-all">{step.expectedResult || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs font-semibold mb-1">Actual Result</p>
                                    <p className="text-xs break-all">{step.actualResult || '—'}</p>
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
                                    <img
                                      src={step.screenshotDataUrl}
                                      alt={`Step ${step.stepOrder} screenshot`}
                                      className="rounded border max-h-64 object-contain"
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  {allSteps.length === 0 && (
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
        </div>
      </ScrollArea>
    </>
  );
}
