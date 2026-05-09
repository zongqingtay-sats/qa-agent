"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Play, Trash2, Download, MoreHorizontal } from "lucide-react";
import { testCasesApi, testRunsApi, exportApi } from "@/lib/api";
import { getExtensionId, connectToExtension, executeTestViaExtension } from "@/lib/extension";
import { toast } from "sonner";

export default function TestCasesPage() {
  const router = useRouter();
  const [testCases, setTestCases] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestCases();
  }, []);

  async function loadTestCases() {
    try {
      const res = await testCasesApi.list({ search: search || undefined });
      setTestCases(res.data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(loadTestCases, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === testCases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(testCases.map(tc => tc.id)));
    }
  }

  async function handleDelete(id: string) {
    try {
      await testCasesApi.delete(id);
      toast.success("Test case deleted");
      loadTestCases();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleExport(id: string, format: 'json' | 'docx' | 'pdf') {
    try {
      const blob = await exportApi.testCase(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-case.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleExportSelected(format: 'json' | 'docx' | 'pdf') {
    if (selected.size === 0) return;
    for (const id of selected) {
      await handleExport(id, format);
    }
    toast.success(`Exported ${selected.size} test case(s) as ${format.toUpperCase()}`);
  }

  async function handleRunSelected() {
    if (selected.size === 0) return;

    const extensionId = getExtensionId();
    if (!extensionId) {
      toast.error("No extension ID configured. Go to Settings to set it up.");
      return;
    }

    try {
      for (const testCaseId of selected) {
        // 1. Fetch the test case flow data
        const tcRes = await testCasesApi.get(testCaseId);
        const testCase = tcRes.data;
        let flowData: any;
        try {
          flowData = typeof testCase.flowData === 'string' ? JSON.parse(testCase.flowData) : testCase.flowData;
        } catch {
          toast.error(`Invalid flow data for "${testCase.name}"`);
          continue;
        }

        // 2. Create a test run record
        const runRes = await testRunsApi.create(testCaseId);
        const testRun = runRes.data;

        // 3. Find the base URL from the start node
        const startNode = (flowData.nodes || []).find((n: any) => n.data?.blockType === 'start');
        const baseUrl = startNode?.data?.baseUrl || 'http://localhost:3000';

        // 4. Connect to the extension and execute
        const stepResults: any[] = [];
        const startTime = Date.now();

        const connection = connectToExtension(extensionId, {
          onConnected: () => {
            toast.info(`Running "${testCase.name}"...`);
            executeTestViaExtension(connection!.port, flowData, testCaseId, baseUrl);
          },
          onStepComplete: (data) => {
            stepResults.push(data);
          },
          onStepError: (data) => {
            stepResults.push({ ...data, status: 'failed' });
          },
          onTestComplete: async (data) => {
            const durationMs = Date.now() - startTime;
            const passedSteps = stepResults.filter(s => s.status === 'passed').length;
            const failedSteps = stepResults.filter(s => s.status === 'failed').length;
            const status = failedSteps > 0 ? 'failed' : 'passed';

            try {
              await testRunsApi.update(testRun.id, {
                status,
                completedAt: new Date().toISOString(),
                durationMs,
                totalSteps: stepResults.length,
                passedSteps,
                failedSteps,
                stepResults: stepResults.map((sr, i) => ({
                  stepOrder: i + 1,
                  blockId: sr.blockId || '',
                  blockType: sr.blockType || '',
                  description: sr.description || '',
                  target: sr.target || '',
                  expectedResult: sr.expectedResult || '',
                  actualResult: sr.actualResult || '',
                  status: sr.status || 'passed',
                  screenshotDataUrl: sr.screenshot || sr.screenshotDataUrl || '',
                  errorMessage: sr.error || sr.errorMessage || '',
                  durationMs: sr.durationMs || 0,
                })),
              });
              toast.success(`"${testCase.name}" ${status}`);
            } catch {
              toast.error(`Failed to save results for "${testCase.name}"`);
            }
            connection?.disconnect();
          },
          onDisconnect: () => {
            // If disconnected before completion, save whatever results we have
            const durationMs = Date.now() - startTime;
            const passedSteps = stepResults.filter(s => s.status === 'passed').length;
            const failedSteps = stepResults.filter(s => s.status === 'failed').length;
            const status = failedSteps > 0 ? 'failed' : (stepResults.length === 0 ? 'failed' : 'passed');

            testRunsApi.update(testRun.id, {
              status,
              completedAt: new Date().toISOString(),
              durationMs,
              totalSteps: stepResults.length || undefined,
              passedSteps: stepResults.length ? passedSteps : undefined,
              failedSteps: stepResults.length ? failedSteps : undefined,
              stepResults: stepResults.length ? stepResults.map((sr, i) => ({
                stepOrder: i + 1,
                blockId: sr.blockId || '',
                blockType: sr.blockType || '',
                description: sr.description || '',
                target: sr.target || '',
                expectedResult: sr.expectedResult || '',
                actualResult: sr.actualResult || '',
                status: sr.status || 'passed',
                screenshotDataUrl: sr.screenshot || sr.screenshotDataUrl || '',
                errorMessage: sr.error || sr.errorMessage || '',
                durationMs: sr.durationMs || 0,
              })) : undefined,
            }).catch(() => {});
          },
        });

        if (!connection) {
          toast.error("Could not connect to extension. Is it installed and enabled?");
          await testRunsApi.update(testRun.id, {
            status: 'failed',
            completedAt: new Date().toISOString(),
          });
          continue;
        }
      }

      setSelected(new Set());
      router.push("/test-runs");
    } catch (err: any) {
      toast.error(err.message || "Failed to run test cases");
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    try {
      for (const id of selected) {
        await testCasesApi.delete(id);
      }
      toast.success(`Deleted ${selected.size} test case(s)`);
      setSelected(new Set());
      loadTestCases();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  async function handleCreateNew() {
    try {
      const res = await testCasesApi.create({
        name: "New Test Case",
        description: "",
        flowData: {
          nodes: [
            { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
            { id: "end-1", type: "endNode", position: { x: 250, y: 400 }, data: { label: "End", blockType: "end" } },
          ],
          edges: [],
        },
      });
      router.push(`/test-cases/${res.data.id}/editor`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Test Cases"
        description="Manage and run your test cases"
        actions={
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Test Case
          </Button>
        }
      />
      <div className="flex-1 p-4 space-y-2">
        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search test cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={handleRunSelected}>
              <Play className="h-4 w-4 mr-1" />
              Run Selected
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              } />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportSelected('json')}>Export as JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected('docx')}>Export as DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSelected('pdf')}>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={testCases.length > 0 && selected.size === testCases.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : testCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No test cases found. Create one or import from a document.
                  </TableCell>
                </TableRow>
              ) : (
                testCases.map((tc) => (
                  <TableRow key={tc.id} className="cursor-pointer" onClick={() => router.push(`/test-cases/${tc.id}/editor`)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(tc.id)}
                        onCheckedChange={() => toggleSelect(tc.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{tc.name}</TableCell>
                    <TableCell>
                      <Badge variant={tc.status === 'active' ? 'default' : 'secondary'}>
                        {tc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(tc.tags || []).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(tc.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/test-cases/${tc.id}/editor`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(tc.id, 'json')}>
                            <Download className="h-4 w-4 mr-2" /> Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(tc.id, 'docx')}>
                            <Download className="h-4 w-4 mr-2" /> Export DOCX
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(tc.id, 'pdf')}>
                            <Download className="h-4 w-4 mr-2" /> Export PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(tc.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
