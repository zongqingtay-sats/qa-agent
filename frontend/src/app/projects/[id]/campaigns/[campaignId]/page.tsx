/**
 * Campaign detail / edit page.
 *
 * Allows editing campaign name, description, base URL,
 * and adding/removing test cases from the campaign.
 */

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Search, Plus, X } from "lucide-react";
import { campaignsApi, projectsApi } from "@/lib/api";
import { TestCaseRow } from "@/components/test-case-row";
import type { Campaign, ProjectTestCase } from "@/types/api";
import { toast } from "sonner";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id: projectId, campaignId } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useBreadcrumbLabel(campaignId, campaign?.name || undefined);
  const [saving, setSaving] = useState(false);

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
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const loadTestCases = useCallback(async () => {
    try {
      const res = await projectsApi.getTestCases(projectId);
      setAllTestCases(res.data);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { loadCampaign(); loadTestCases(); }, [loadCampaign, loadTestCases]);

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (testCaseIds.size === 0) { toast.error("At least one test case is required"); return; }

    setSaving(true);
    try {
      await campaignsApi.update(campaignId, {
        name: name.trim(),
        description: description.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        testCaseIds: Array.from(testCaseIds),
      });
      toast.success("Campaign saved");
      router.push(`/projects/${projectId}/campaigns`);
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  function removeTestCase(id: string) {
    setTestCaseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addTestCase(id: string) {
    setTestCaseIds((prev) => new Set(prev).add(id));
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
      <div className="flex items-center justify-between p-4 pb-0">
        <h2 className="text-lg font-semibold">{campaign.name}</h2>
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

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
                  placeholder="e.g. UAT Regression Suite"
                  className="text-sm bg-transparent border-none outline-none w-full"
                />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Description</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description"
                  rows={3}
                  className="text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground w-full"
                />
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-muted-foreground text-xs font-semibold mb-1">Base URL</p>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://app-uat.example.com"
                  className="text-sm bg-transparent border-none outline-none w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Overrides the origin of the first navigation step when running tests.
                </p>
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
    </>
  );
}
