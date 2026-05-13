/**
 * Test case overview / detail page.
 *
 * Renders metadata, project assignment, assignees, flow preview,
 * recent run history, and a comments sidebar.
 *
 * State and inline-edit logic live in `useTestCaseDetail`;
 * the details card is rendered by `DetailsCard`.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Clock, FolderKanban, TestTube2, Trash2, Play, MoreVertical } from "lucide-react";
import { testCasesApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { CommentsSection } from "./_components/comments-section";
import { AssigneeSection } from "./_components/assignee-section";
import { FlowPreview } from "./_components/flow-preview";
import { DetailsCard } from "./_components/details-card";
import { AssignProjectDialog } from "@/components/assign-project-dialog";
import { useTestCaseDetail } from "./_hooks/use-test-case-detail";
import { toast } from "sonner";

export default function TestCaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: testCaseId } = use(params);
  const router = useRouter();
  const d = useTestCaseDetail(testCaseId);

  if (d.loading || !d.testCase) {
    return (<><PageHeader title="Loading..." /><div className="flex-1 p-4" /></>);
  }

  const recentRuns = d.runs.slice(0, 5);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5 shrink-0" />
            <input value={d.testCaseName} onChange={(e) => d.setTestCaseName(e.target.value)} onBlur={d.handleNameCommit}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { d.setTestCaseName(d.testCase!.name); (e.target as HTMLInputElement).blur(); } }}
              className="bg-transparent border-none outline-none text-lg font-semibold w-full" placeholder="Test case name..." />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/test-cases/${testCaseId}/editor`} />}>
              <Pencil className="h-4 w-4 mr-1" /> Edit Flow
            </Button>
            <Button variant="outline" disabled={d.running} onClick={async () => {
              d.setRunning(true);
              try { await runTestCase(testCaseId); await d.load(); }
              catch { toast.error("Failed to run test"); }
              finally { d.setRunning(false); }
            }}>
              <Play className="h-4 w-4 mr-1" /> {d.running ? "Running..." : "Run"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => d.setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex-1 p-4 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <DetailsCard
            testCaseId={testCaseId} status={d.testCase.status}
            descriptionInput={d.descriptionInput} setDescriptionInput={d.setDescriptionInput}
            handleDescriptionCommit={d.handleDescriptionCommit} originalDescription={d.testCase.description || ""}
            preconditionsInput={d.preconditionsInput} setPreconditionsInput={d.setPreconditionsInput}
            handlePreconditionsCommit={d.handlePreconditionsCommit} originalPreconditions={d.testCase.preconditions || ""}
            passingCriteriaInput={d.passingCriteriaInput} setPassingCriteriaInput={d.setPassingCriteriaInput}
            handlePassingCriteriaCommit={d.handlePassingCriteriaCommit} originalPassingCriteria={d.testCase.passingCriteria || ""}
            tagsInput={d.tagsInput} setTagsInput={d.setTagsInput} handleTagsCommit={d.handleTagsCommit}
          />

          <div className="flex gap-4">
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Project</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => d.setAssignDialogOpen(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.testCase.projectId ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-semibold w-20">Project </span>
                      <Link href={`/projects/${d.testCase.projectId}`} className="text-primary hover:underline">{d.testCase.projectName || d.testCase.projectId}</Link>
                    </div>
                    {d.testCase.featureIds?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-semibold w-20">Features </span>
                        {(d.testCase.featureNames || d.testCase.featureIds).join(", ")}
                      </div>
                    )}
                    {d.testCase.phaseIds?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-semibold w-20">Phases </span>
                        {(d.testCase.phaseNames || d.testCase.phaseIds).join(", ")}
                      </div>
                    )}
                  </>
                ) : <p className="text-sm text-muted-foreground">Not assigned to a project</p>}
              </CardContent>
            </Card>
            <AssigneeSection testCaseId={testCaseId} />
          </div>

          <FlowPreview testCaseId={testCaseId} flowData={d.testCase.flowData} />

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Runs</CardTitle></CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet</p> : (
                <div className="space-y-2">
                  {recentRuns.map((run) => (
                    <Link key={run.id} href={`/test-runs/${run.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={run.status} size="sm" />
                        <span className="text-sm text-muted-foreground">{new Date(run.startedAt || run.createdAt || "").toLocaleString()}</span>
                      </div>
                      {run.runByName && (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0" title={run.runByName}>
                            {run.runByName[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="text-sm text-muted-foreground">{run.runByName}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                  {d.runs.length > 5 && <Link href={`/test-runs?testCaseId=${testCaseId}`} className="text-sm text-primary hover:underline">View all {d.runs.length} runs →</Link>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4"><CommentsSection testCaseId={testCaseId} /></div>
      </div>

      <AssignProjectDialog open={d.assignDialogOpen} onOpenChange={d.setAssignDialogOpen}
        testCaseIds={[testCaseId]} currentProjectId={d.testCase.projectId}
        currentFeatureIds={d.testCase.featureIds || []} currentPhaseIds={d.testCase.phaseIds || []}
        onAssigned={d.load} />

      <Dialog open={d.deleteDialogOpen} onOpenChange={d.setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Test Case</DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{d.testCase.name}&quot;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => d.setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              try { await testCasesApi.delete(testCaseId); toast.success("Deleted"); router.push("/test-cases"); }
              catch { toast.error("Failed to delete"); }
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
