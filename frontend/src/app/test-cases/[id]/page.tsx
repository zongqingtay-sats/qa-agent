"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, use } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Pencil,
  Clock,
  FolderKanban,
} from "lucide-react";
import { testCasesApi, testRunsApi } from "@/lib/api";
import { CommentsSection } from "./_components/comments-section";
import { AssigneeSection } from "./_components/assignee-section";
import { AssignProjectDialog } from "@/components/assign-project-dialog";
import { toast } from "sonner";

export default function TestCaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testCaseId } = use(params);

  const [testCase, setTestCase] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tcRes, runsRes] = await Promise.all([
        testCasesApi.get(testCaseId),
        testRunsApi.list({ testCaseId }),
      ]);
      setTestCase(tcRes.data);
      setRuns(runsRes.data);
    } catch {
      toast.error("Failed to load test case");
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !testCase) {
    return (
      <>
        <PageHeader title="Loading..." />
        <div className="flex-1 p-4" />
      </>
    );
  }

  const stepCount = testCase.steps?.length ?? 0;
  const recentRuns = runs.slice(0, 5);

  return (
    <>
      <PageHeader
        title={testCase.name}
        description={testCase.description || undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/test-cases/${testCaseId}/editor`} />}>
              <Pencil className="h-4 w-4 mr-1" /> Edit Flow
            </Button>
          </div>
        }
      />
      <div className="flex-1 p-4 grid gap-4 md:grid-cols-3">
        {/* Main content - 2 cols */}
        <div className="md:col-span-2 space-y-4">
          {/* Details card */}
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-20">Status</span>
                <StatusBadge status={testCase.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground w-20">Steps</span>
                <span className="text-sm">{stepCount} steps</span>
              </div>
              {testCase.description && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Description</span>
                  <p className="text-sm mt-1">{testCase.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <CommentsSection testCaseId={testCaseId} />

          {/* Run History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet</p>
              ) : (
                <div className="space-y-2">
                  {recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/test-runs/${run.id}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={run.status} size="sm" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.startedAt || run.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {run.runByName && (
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center" title={run.runByName}>
                          {run.runByName[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                    </Link>
                  ))}
                  {runs.length > 5 && (
                    <Link href={`/test-runs?testCaseId=${testCaseId}`} className="text-sm text-primary hover:underline">
                      View all {runs.length} runs →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 col */}
        <div className="space-y-4">
          {/* Project / Feature / Phase */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Project</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAssignDialogOpen(true)}>
                  Edit
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {testCase.projectId ? (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Project: </span>
                    <Link href={`/projects/${testCase.projectId}`} className="text-primary hover:underline">
                      {testCase.projectName || testCase.projectId}
                    </Link>
                  </div>
                  {testCase.featureIds?.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Features: </span>
                      {(testCase.featureNames || testCase.featureIds).join(", ")}
                    </div>
                  )}
                  {testCase.phaseIds?.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Phases: </span>
                      {(testCase.phaseNames || testCase.phaseIds).join(", ")}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not assigned to a project</p>
              )}
            </CardContent>
          </Card>

          {/* Assignees */}
          <AssigneeSection testCaseId={testCaseId} />
        </div>
      </div>

      <AssignProjectDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        testCaseIds={[testCaseId]}
        currentProjectId={testCase.projectId}
        currentFeatureIds={testCase.featureIds || []}
        currentPhaseIds={testCase.phaseIds || []}
        onAssigned={load}
      />
    </>
  );
}
