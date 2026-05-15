/**
 * Campaign detail / edit page.
 *
 * Allows editing campaign name, description, base URL,
 * and adding/removing test cases from the campaign.
 *
 * Route: /campaigns/[id]
 */

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, X, MoreVertical, Trash2, Play, ListChecks } from "lucide-react";
import { campaignsApi, projectsApi } from "@/lib/api";
import { runCampaign } from "@/lib/run-campaign";
import { TestCaseRow } from "@/components/test-case-row";
import type { Campaign, ProjectTestCase } from "@/types/api";
import { toast } from "sonner";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string; }>; }) {
  const { id: campaignId } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("");

  useBreadcrumbLabel(campaignId, campaign?.name || undefined);
  const [running, setRunning] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [testCaseIds, setTestCaseIds] = useState<Set<string>>(new Set());

  // All project test cases for the add picker
  const [allTestCases, setAllTestCases] = useState<ProjectTestCase[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const res = await campaignsApi.get(campaignId);
      const c = res.data;
      setCampaign(c);
      setName(c.name);
      setDescription(c.description || "");
      setBaseUrl(c.baseUrl || "");
      setTestCaseIds(new Set(c.testCaseIds));

      // Load project info
      try {
        const projRes = await projectsApi.get(c.projectId);
        setProjectName(projRes.data.name);
      } catch { /* ignore */ }

      // Load test cases for picker
      try {
        const tcRes = await projectsApi.getTestCases(c.projectId);
        setAllTestCases(tcRes.data);
      } catch { /* ignore */ }
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);

  /** Auto-save a partial update. */
  const autoSave = useCallback(async (fields: Partial<{ name: string; description: string; baseUrl: string; testCaseIds: string[]; }>) => {
    if (!campaign) return;
    const payload = {
      name: (fields.name ?? name).trim() || campaign.name,
      description: (fields.description ?? description).trim() || undefined,
      baseUrl: (fields.baseUrl ?? baseUrl).trim() || undefined,
      testCaseIds: fields.testCaseIds ?? Array.from(testCaseIds),
    };
    try {
      await campaignsApi.update(campaignId, payload);
    } catch {
      toast.error("Failed to save");
    }
  }, [campaign, campaignId, name, description, baseUrl, testCaseIds]);

  function handleNameCommit() {
    if (!name.trim()) { setName(campaign!.name); return; }
    if (name.trim() !== campaign!.name) {
      autoSave({ name: name.trim() });
    }
  }

  function handleDescriptionCommit() {
    if ((description.trim() || "") !== (campaign!.description || "")) {
      autoSave({ description: description.trim() });
    }
  }

  function handleBaseUrlCommit() {
    if ((baseUrl.trim() || "") !== (campaign!.baseUrl || "")) {
      autoSave({ baseUrl: baseUrl.trim() });
    }
  }

  function removeTestCase(id: string) {
    setTestCaseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      const arr = Array.from(next);
      autoSave({ testCaseIds: arr });
      return next;
    });
  }

  function addTestCase(id: string) {
    setTestCaseIds((prev) => {
      const next = new Set(prev).add(id);
      const arr = Array.from(next);
      autoSave({ testCaseIds: arr });
      return next;
    });
  }

  // Test cases currently in the campaign
  const includedTestCases = allTestCases.filter((tc) => testCaseIds.has(tc.id));
  // Test cases available to add (not already included), filtered by search
  const availableTestCases = allTestCases
    .filter((tc) => !testCaseIds.has(tc.id))
    .filter((tc) => !search || tc.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-muted-foreground">Loading campaign…</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-muted-foreground">Campaign not found</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(campaign!.name); (e.target as HTMLInputElement).blur(); } }}
              className="bg-transparent border-none outline-none text-lg font-semibold w-full"
              placeholder="Campaign name..."
            />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={running} onClick={async () => {
              setRunning(true);
              try { await runCampaign(campaignId, baseUrl || undefined); toast.success("Campaign started"); }
              catch { toast.error("Failed to run campaign"); }
              finally { setRunning(false); }
            }}>
              <Play className="h-4 w-4 mr-1" /> {running ? "Running…" : "Run"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex-1 p-4 space-y-4">
        {/* ── Campaign Details ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Name</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleNameCommit}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(campaign!.name); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="e.g. UAT Regression Suite"
                  className="text-sm bg-transparent border-none outline-none w-full"
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionCommit}
                  placeholder="Add a description"
                  rows={3}
                  className="text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground w-full"
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Base URL</p>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  onBlur={handleBaseUrlCommit}
                  placeholder="Overrides the origin of the first navigation step when running tests."
                  className="text-sm bg-transparent border-none outline-none w-full"
                />
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Project</p>
                <Link
                  href={`/projects/${campaign.projectId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {projectName || campaign.projectId}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">ID</p>
                <span className="font-mono text-xs text-muted-foreground">{campaignId}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Included Test Cases ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Test Cases <Badge variant="secondary" className="ml-2">{testCaseIds.size}</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowPicker(!showPicker)}>
              <Plus className="h-4 w-4 mr-1" /> Add Test Cases
            </Button>
          </CardHeader>
          <CardContent>
            {includedTestCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test cases in this campaign.</p>
            ) : (
              <div className="space-y-1">
                {includedTestCases.map((tc) => (
                  <TestCaseRow
                    key={tc.id}
                    testCase={tc}
                    showCheckbox={false}
                    showStatus
                    showAvatars
                    showLastRunStatus
                    actions={[
                      { key: "remove", icon: <X className="h-3 w-3" />, title: "Remove from campaign", onClick: () => removeTestCase(tc.id) },
                    ]}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Add Test Cases Picker ── */}
        {showPicker && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Test Cases</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search test cases..."
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {availableTestCases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? "No matching test cases found." : "All test cases are already in this campaign."}
                </p>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-1">
                    {availableTestCases.map((tc) => (
                      <div key={tc.id} onClick={() => addTestCase(tc.id)} className="cursor-pointer">
                        <TestCaseRow
                          testCase={tc}
                          showCheckbox
                          selected={false}
                          onToggleSelect={() => addTestCase(tc.id)}
                          linkToDetail={false}
                          showStatus
                          showAvatars={false}
                          showLastRunStatus={false}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              try {
                await campaignsApi.delete(campaignId);
                toast.success("Campaign deleted");
                router.push(`/projects/${campaign.projectId}/campaigns`);
              } catch { toast.error("Failed to delete"); }
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
