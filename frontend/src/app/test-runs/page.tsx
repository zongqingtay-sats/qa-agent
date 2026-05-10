"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

export default function TestRunsPage() {
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runDetails, setRunDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTestRuns();
  }, []);

  async function loadTestRuns() {
    try {
      const res = await testRunsApi.list();
      setTestRuns(res.data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  // Real-time updates via SSE
  useSSE({
    channels: ["test-runs"],
    onEvent: useCallback((event: any) => {
      if (event.type === "test-run:created") {
        setTestRuns((prev) => [event.data, ...prev]);
      } else if (event.type === "test-run:updated") {
        setTestRuns((prev) =>
          prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r))
        );
      }
    }, []),
  });

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === testRuns.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(testRuns.map(r => r.id)));
    }
  }

  async function handleExportSelected(format: 'json' | 'docx' | 'pdf') {
    for (const id of selected) {
      await handleExport(id, format);
    }
  }

  async function handleExport(id: string, format: 'json' | 'docx' | 'pdf') {
    try {
      const blob = await exportApi.testRun(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-run.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRetry(run: any) {
    try {
      await runTestCase(run.testCaseId);
    } catch (err: any) {
      toast.error(err.message || "Failed to retry test run");
    }
  }

  async function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Fetch details if not already loaded
        if (!runDetails[id]) {
          testRunsApi.get(id).then(res => {
            setRunDetails(prev => ({ ...prev, [id]: res.data }));
          }).catch(() => { /* ignore */ });
        }
      }
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Test Runs" description="View execution history and results" />
      <div className="flex-1 p-4">
        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              } />
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExportSelected('json')}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected('docx')}>Export as DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected('pdf')}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={testRuns.length > 0 && selected.size === testRuns.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Test Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : testRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No test runs yet. Run a test case to see results here.
                  </TableCell>
                </TableRow>
              ) : (
              testRuns.map((run) => (
                  <Fragment key={run.id}>
                    <TableRow key={run.id} className="cursor-pointer" onClick={() => toggleExpand(run.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(run.id)}
                          onCheckedChange={() => toggleSelect(run.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {expanded.has(run.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <Link href={`/test-runs/${run.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                            {run.testCaseName}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-sm">
                        <span className="text-green-600">{run.passedSteps}</span>
                        {" / "}
                        <span>{run.totalSteps}</span>
                        {run.failedSteps > 0 && (
                          <span className="text-red-600 ml-1">({run.failedSteps} failed)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Retry" onClick={() => handleRetry(run)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Export">
                                <Download className="h-3 w-3" />
                              </Button>
                            } />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExport(run.id, 'json')}>Export as JSON</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(run.id, 'docx')}>Export as DOCX</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(run.id, 'pdf')}>Export as PDF</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded.has(run.id) && (
                      <TableRow key={`${run.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <div className="px-6 py-4 space-y-3">
                            {!runDetails[run.id] ? (
                              <p className="text-sm text-muted-foreground">Loading details...</p>
                            ) : (
                              <>
                                {/* Summary info */}
                                <div className="flex gap-6 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Test Case ID: </span>
                                    <Link href={`/test-cases/${runDetails[run.id].testCaseId}/editor`} className="text-primary hover:underline">
                                      {runDetails[run.id].testCaseId?.slice(0, 8)}...
                                    </Link>
                                  </div>
                                  {runDetails[run.id].completedAt && (
                                    <div>
                                      <span className="text-muted-foreground">Completed: </span>
                                      {new Date(runDetails[run.id].completedAt).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                {/* Step results table */}
                                {runDetails[run.id].stepResults && runDetails[run.id].stepResults.length > 0 && (
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
                                        {runDetails[run.id].stepResults.map((step: any, idx: number) => (
                                          <TableRow key={step.id || idx}>
                                            <TableCell className="text-xs">{step.stepOrder ?? idx + 1}</TableCell>
                                            <TableCell className="text-xs font-mono">{step.blockType}</TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate">{step.description || step.target || '—'}</TableCell>
                                            <TableCell><StatusBadge status={step.status} /></TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                              {step.durationMs ? `${(step.durationMs / 1000).toFixed(2)}s` : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                                              {step.errorMessage || ''}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                                <div className="flex justify-end">
                                  <Link href={`/test-runs/${run.id}`}>
                                    <Button variant="outline" size="sm">View Full Details</Button>
                                  </Link>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
