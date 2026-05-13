/**
 * Test cases list page.
 *
 * Displays all test cases in a searchable, selectable table with
 * bulk actions (run, delete, export) and create/generate buttons.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Play, Trash2, Download, Sparkles, FolderKanban, TestTube2 } from "lucide-react";
import { testCasesApi, exportApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { toast } from "sonner";
import { TestCaseTable } from "./_components/test-case-table";
import { AssignProjectDialog } from "@/components/assign-project-dialog";

export default function TestCasesPage() {
  const router = useRouter();
  const [testCases, setTestCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => { loadTestCases(); }, []);

  /** Reload list whenever search changes (debounced). */
  useEffect(() => {
    const timeout = setTimeout(loadTestCases, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function loadTestCases() {
    try { setTestCases((await testCasesApi.list({ search: search || undefined })).data); }
    catch { /* API not available */ }
    finally { setLoading(false); }
  }

  // ── Selection ──

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(selected.size === testCases.length ? new Set() : new Set(testCases.map((tc) => tc.id)));
  }

  // ── Single-item actions ──

  async function handleDelete(id: string) {
    try { await testCasesApi.delete(id); toast.success("Test case deleted"); loadTestCases(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function handleExport(id: string, format: "json" | "docx" | "pdf") {
    try {
      const blob = await exportApi.testCase(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `test-case.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRunSingle(id: string) {
    try { await runTestCase(id); router.push("/test-runs"); }
    catch (err: any) { toast.error(err.message || "Failed to run test case"); }
  }

  // ── Bulk actions ──

  async function handleExportSelected(format: "json" | "docx" | "pdf") {
    if (selected.size === 0) return;
    for (const id of selected) await handleExport(id, format);
    toast.success(`Exported ${selected.size} test case(s) as ${format.toUpperCase()}`);
  }

  async function handleRunSelected() {
    if (selected.size === 0) return;
    try {
      for (const id of selected) await runTestCase(id);
      setSelected(new Set());
      router.push("/test-runs");
    } catch (err: any) { toast.error(err.message || "Failed to run test cases"); }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    try {
      for (const id of selected) await testCasesApi.delete(id);
      toast.success(`Deleted ${selected.size} test case(s)`);
      setSelected(new Set());
      loadTestCases();
    } catch (err: any) { toast.error(err.message || "Failed to delete"); }
  }

  /** Create a new empty test case with the default flow scaffold. */
  async function handleCreateNew() {
    try {
      const res = await testCasesApi.create({
        name: "New Test Case",
        description: "",
        flowData: {
          nodes: [
            { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
            { id: "navigate-1", type: "actionNode", position: { x: 250, y: 170 }, data: { label: "Navigate to URL", blockType: "navigate", url: "" } },
            { id: "assert-1", type: "assertNode", position: { x: 250, y: 290 }, data: { label: "Assert", blockType: "assert", assertionType: "element-exists" } },
            { id: "end-1", type: "endNode", position: { x: 250, y: 410 }, data: { label: "End", blockType: "end" } },
          ],
          edges: [
            { id: "e-start-nav", source: "start-1", target: "navigate-1", animated: true },
            { id: "e-assert-end", source: "assert-1", target: "end-1", animated: true },
          ],
        },
      });
      router.push(`/test-cases/${res.data.id}`);
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><TestTube2 className="h-5 w-5" /> Test Cases</span>}
        description="Manage and run your test cases"
        actions={
          <>
            <Button onClick={handleCreateNew}><Plus className="h-4 w-4" /> Create</Button>
            <Button onClick={() => router.push("/generate")}><Sparkles className="h-4 w-4" /> Generate</Button>
          </>
        }
      />
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search test cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button variant="outline" onClick={handleRunSelected}><Play className="h-4 w-4 mr-1" /> Run</Button>
            <Button variant="outline" onClick={() => setAssignDialogOpen(true)}><FolderKanban className="h-4 w-4 mr-1" /> Assign to Project</Button>
            <Button variant="outline" className="text-destructive" onClick={handleDeleteSelected}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportSelected("json")}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected("docx")}>Export as DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected("pdf")}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <TestCaseTable
          testCases={testCases}
          loading={loading}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRun={handleRunSingle}
          onDelete={handleDelete}
          onExport={handleExport}
        />
      </div>

      <AssignProjectDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        testCaseIds={Array.from(selected)}
        onAssigned={() => { setSelected(new Set()); loadTestCases(); }}
      />
    </>
  );
}
