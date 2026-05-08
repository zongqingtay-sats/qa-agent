"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { toast } from "sonner";

export default function TestRunsPage() {
  const [testRuns, setTestRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  function statusBadge(status: string) {
    switch (status) {
      case 'passed': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Passed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'running': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Running</Badge>;
      case 'stopped': return <Badge variant="secondary">Stopped</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <>
      <PageHeader title="Test Runs" description="View execution history and results" />
      <div className="flex-1 p-6">
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : testRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No test runs yet. Run a test case to see results here.
                  </TableCell>
                </TableRow>
              ) : (
                testRuns.map((run) => (
                  <TableRow key={run.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/test-runs/${run.id}`} className="font-medium hover:underline">
                        {run.testCaseName}
                      </Link>
                    </TableCell>
                    <TableCell>{statusBadge(run.status)}</TableCell>
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
                      {new Date(run.startedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExport(run.id, 'json')} title="Export JSON">
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExport(run.id, 'pdf')} title="Export PDF">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
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
