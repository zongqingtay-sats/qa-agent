"use client";

import { useEffect, useState } from "react";
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
import { Download } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { toast } from "sonner";

export default function TestRunsPage() {
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
                <TableHead className="w-24">Export</TableHead>
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
                  <TableRow key={run.id} className="cursor-pointer">
                    <TableCell>
                      <Checkbox
                        checked={selected.has(run.id)}
                        onCheckedChange={() => toggleSelect(run.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/test-runs/${run.id}`} className="font-medium hover:underline">
                        {run.testCaseName}
                      </Link>
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
                    <TableCell>
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
