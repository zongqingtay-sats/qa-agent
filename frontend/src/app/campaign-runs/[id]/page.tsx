/**
 * Campaign run monitoring page.
 *
 * Shows real-time progress of a campaign run, with each test case's
 * status updating as the campaign executes.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Clock, MinusCircle } from "lucide-react";
import { campaignsApi, testCasesApi } from "@/lib/api";
import type { CampaignRun } from "@/types/api";

interface TestCaseStatus {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  testRunId?: string;
}

export default function CampaignRunPage() {
  const params = useParams();
  const runId = params.id as string;

  const [campaignRun, setCampaignRun] = useState<CampaignRun | null>(null);
  const [testCases, setTestCases] = useState<TestCaseStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: run } = await campaignsApi.getRun(runId);
      setCampaignRun(run);

      const { data: campaign } = await campaignsApi.get(run.campaignId);

      // Load test case names
      const cases: TestCaseStatus[] = await Promise.all(
        campaign.testCaseIds.map(async (tcId) => {
          let name = tcId;
          try {
            const { data: tc } = await testCasesApi.get(tcId);
            name = tc.name;
          } catch { /* fallback to id */ }

          const testRunId = run.testRunIds[tcId];
          let status: TestCaseStatus["status"] = "pending";
          if (testRunId) {
            // Has a run - check if it's in the completed counts
            const completedCount = run.passedCases + run.failedCases;
            const idx = campaign.testCaseIds.indexOf(tcId);
            if (idx < completedCount) {
              // Determine from testRunIds existence and overall status
              status = "passed"; // will be refined below
            } else if (idx === completedCount) {
              status = "running";
            }
          }

          return { id: tcId, name, status, testRunId };
        })
      );

      // Refine statuses based on pass/fail counts
      let passCount = 0;
      let failCount = 0;
      for (const tc of cases) {
        if (tc.testRunId && tc.status !== "running" && tc.status !== "pending") {
          if (passCount < run.passedCases) {
            tc.status = "passed";
            passCount++;
          } else if (failCount < run.failedCases) {
            tc.status = "failed";
            failCount++;
          }
        }
      }

      setTestCases(cases);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [runId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for updates while running
  useEffect(() => {
    if (!campaignRun || campaignRun.status !== "running") return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [campaignRun, loadData]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaignRun) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">Campaign run not found</p>
      </div>
    );
  }

  const statusBadge = {
    running: <Badge className="bg-blue-500/10 text-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>,
    passed: <Badge className="bg-green-500/10 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Passed</Badge>,
    failed: <Badge className="bg-red-500/10 text-red-600"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>,
    stopped: <Badge className="bg-yellow-500/10 text-yellow-600"><MinusCircle className="h-3 w-3 mr-1" />Stopped</Badge>,
  };

  return (
    <>
      <PageHeader
        title={campaignRun.campaignName || "Campaign Run"}
        description={`Started ${new Date(campaignRun.startedAt).toLocaleString()}`}
        actions={statusBadge[campaignRun.status]}
      />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{campaignRun.totalCases}</div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{campaignRun.passedCases}</div>
              <p className="text-sm text-muted-foreground">Passed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{campaignRun.failedCases}</div>
              <p className="text-sm text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{campaignRun.durationMs ? `${(campaignRun.durationMs / 1000).toFixed(1)}s` : '—'}</div>
              <p className="text-sm text-muted-foreground">Duration</p>
            </CardContent>
          </Card>
        </div>

        {/* Test Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {testCases.map((tc) => (
              <div key={tc.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                <span className="text-sm font-medium">{tc.name}</span>
                <div className="flex items-center gap-2">
                  {tc.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                  {tc.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                  {tc.status === "passed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {tc.status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                  {tc.testRunId && (
                    <a href={`/test-runs/${tc.testRunId}`} className="text-xs text-muted-foreground hover:underline">
                      View Run
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
