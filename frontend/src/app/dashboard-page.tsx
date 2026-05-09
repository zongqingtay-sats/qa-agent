"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TestTube2, Play, Upload, Sparkles, ArrowRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { testCasesApi, testRunsApi } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState({ testCases: 0, testRuns: 0, passed: 0, failed: 0 });
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [casesRes, runsRes] = await Promise.all([
        testCasesApi.list(),
        testRunsApi.list(),
      ]);
      setRecentCases(casesRes.data.slice(0, 5));
      setRecentRuns(runsRes.data.slice(0, 5));
      setStats({
        testCases: casesRes.total,
        testRuns: runsRes.total,
        passed: runsRes.data.filter((r: any) => r.status === 'passed').length,
        failed: runsRes.data.filter((r: any) => r.status === 'failed').length,
      });
    } catch {
      // API not available yet, show empty state
    }
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your QA testing workspace" />
      <div className="flex-1 p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Test Cases</CardTitle>
              <TestTube2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.testCases}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Test Runs</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.testRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:border-primary transition-colors">
            <Link href="/import">
              <CardHeader>
                <Upload className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Import Test Cases</CardTitle>
                <CardDescription>Upload Word, PDF, Text, or JSON documents</CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:border-primary transition-colors">
            <Link href="/generate">
              <CardHeader>
                <Sparkles className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Generate with AI</CardTitle>
                <CardDescription>Create test cases from requirements or natural language</CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:border-primary transition-colors">
            <Link href="/test-cases">
              <CardHeader>
                <TestTube2 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Create New Test</CardTitle>
                <CardDescription>Build a test case from scratch with the visual editor</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Test Cases</CardTitle>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/test-cases" />}>
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentCases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test cases yet. Import or generate some to get started.</p>
              ) : (
                <div className="space-y-3">
                  {recentCases.map((tc: any) => (
                    <Link key={tc.id} href={`/test-cases/${tc.id}/editor`} className="flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{tc.name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tc.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={tc.status === 'active' ? 'default' : 'secondary'}>{tc.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Test Runs</CardTitle>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/test-runs" />}>
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test runs yet. Run a test case to see results here.</p>
              ) : (
                <div className="space-y-3">
                  {recentRuns.map((run: any) => (
                    <Link key={run.id} href={`/test-runs/${run.id}`} className="flex items-center justify-between py-2 hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{run.testCaseName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={run.status === 'passed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                        {run.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
