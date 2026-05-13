/**
 * Test runs list page.
 *
 * Displays all test runs in a table with expandable inline details,
 * bulk actions (re-run, export), search filtering, and real-time
 * SSE updates for step counts and status changes.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, RotateCcw, Search, Play } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";
import { TestRunTable } from "./_components/test-run-table";

export default function TestRunsPage() {
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runDetails, setRunDetails] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");

  useEffect(() => { loadTestRuns(); }, []);

  async function loadTestRuns() {
    try { setTestRuns((await testRunsApi.list()).data); }
    catch { /* API not available */ }
    finally { setLoading(false); }
  }

  // ── Real-time SSE updates ──

  useSSE({
    channels: ["test-runs"],
    onEvent: useCallback((event: any) => {
      if (event.type === "test-run:created") {
        setTestRuns((prev) => [event.data, ...prev]);
      } else if (event.type === "test-run:updated") {
        setTestRuns((prev) => prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r)));
      } else if (event.type === "test-run:step") {
        setTestRuns((prev) =>
          prev.map((r) =>
            r.id === event.data.id
              ? { ...r, totalSteps: event.data.totalSteps, passedSteps: event.data.passedSteps, failedSteps: event.data.failedSteps }
              : r
          )
        );
      }
    }, []),
  });

  // ── Selection helpers ──

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(selected.size === testRuns.length ? new Set() : new Set(testRuns.map((r) => r.id)));
  }

  // ── Actions ──

  async function handleExport(id: string, format: "json" | "docx" | "pdf") {
    try {
      const blob = await exportApi.testRun(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `test-run.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleExportSelected(format: "json" | "docx" | "pdf") {
    for (const id of selected) await handleExport(id, format);
  }

  async function handleRetry(run: any) {
    try { await runTestCase(run.testCaseId); }
    catch (err: any) { toast.error(err.message || "Failed to re-run test"); }
  }

  async function handleRerunSelected() {
    for (const run of testRuns.filter((r) => selected.has(r.id))) await handleRetry(run);
  }

  /** Toggle expansion and lazy-load detail data. */
  async function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); }
      else {
        n.add(id);
        if (!runDetails[id]) {
          testRunsApi.get(id).then((res) => setRunDetails((prev) => ({ ...prev, [id]: res.data }))).catch(() => {});
        }
      }
      return n;
    });
  }

  const filteredRuns = useMemo(() => {
    if (!search.trim()) return testRuns;
    const q = search.toLowerCase();
    return testRuns.filter((r) => r.testCaseName?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q));
  }, [testRuns, search]);

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Play className="h-5 w-5" /> Test Runs</span>} description="View execution history and results" />
      <div className="flex-1 p-4 space-y-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by test case name or status..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button variant="outline" onClick={handleRerunSelected}><RotateCcw className="h-3 w-3 mr-1" /> Re-run</Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline"><Download className="h-3 w-3 mr-1" /> Export</Button>} />
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExportSelected("json")}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected("docx")}>Export as DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected("pdf")}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <TestRunTable
          testRuns={filteredRuns}
          loading={loading}
          hasSearch={!!search.trim()}
          selected={selected}
          expanded={expanded}
          runDetails={runDetails}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onToggleExpand={toggleExpand}
          onRetry={handleRetry}
          onExport={handleExport}
        />
      </div>
    </>
  );
}
