/**
 * Project overview page.
 *
 * Displays summary statistics and recent activity scoped to this project.
 */

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestTube2, Play, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { projectsApi, testRunsApi } from "@/lib/api";
import { formatRelative, formatDateTime } from "@/lib/format-date";
import type { ProjectTestCase, TestRunListItem } from "@/types/api";

export default function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [stats, setStats] = useState({ testCases: 0, testRuns: 0, passed: 0, failed: 0 });
  const [recentRuns, setRecentRuns] = useState<TestRunListItem[]>([]);
  const [recentCases, setRecentCases] = useState<ProjectTestCase[]>([]);

  useEffect(() => { loadData(); }, [projectId]);

  async function loadData() {
    try {
      const [casesRes, runsRes] = await Promise.all([
        projectsApi.getTestCases(projectId),
        testRunsApi.list(),
      ]);

      const projectCases = casesRes.data;
      const projectCaseIds = new Set(projectCases.map((tc) => tc.id));
      const projectRuns = runsRes.data.filter((r) => projectCaseIds.has(r.testCaseId));

      setRecentCases(projectCases.slice(0, 5));
      setRecentRuns(projectRuns.slice(0, 5));
      setStats({
        testCases: projectCases.length,
        testRuns: projectRuns.length,
        passed: projectRuns.filter((r) => r.status === "passed").length,
        failed: projectRuns.filter((r) => r.status === "failed").length,
      });
    } catch { /* ignore */ }
  }

  return (
    <div className="flex-1 p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test Cases</CardTitle>
            <TestTube2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.testCases}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test Runs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.testRuns}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Passed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.passed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{stats.failed}</div></CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Test Cases</CardTitle>
            <Button variant="ghost" nativeButton={false} render={<Link href={`/projects/${projectId}/cases`} />}>
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test cases in this project yet.</p>
            ) : (
              <div className="space-y-3">
                {recentCases.map((tc) => (
                  <Link key={tc.id} href={`/test-cases/${tc.id}`} className="flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{tc.name}</p>
                    </div>
                    <StatusBadge status={tc.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Test Runs</CardTitle>
            <Button variant="ghost" nativeButton={false} render={<Link href={`/projects/${projectId}/runs`} />}>
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test runs for this project yet.</p>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <Link key={run.id} href={`/test-runs/${run.id}`} className="flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{run.testCaseName}</p>
                      <p className="text-xs text-muted-foreground" title={formatDateTime(run.startedAt)}>{formatRelative(run.startedAt)}</p>
                    </div>
                    <StatusBadge status={run.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
