/**
 * Campaigns list page for a project.
 *
 * Shows all campaigns belonging to the project with options to
 * create, edit, delete, and run campaigns.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Play, Pencil, Trash2, Globe } from "lucide-react";
import { campaignsApi } from "@/lib/api";
import { runCampaign } from "@/lib/run-campaign";
import type { Campaign } from "@/types/api";
import { toast } from "sonner";

export default function CampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [runUrlDialog, setRunUrlDialog] = useState<{ campaign: Campaign } | null>(null);
  const [runUrl, setRunUrl] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Campaign | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await campaignsApi.list(projectId);
      setCampaigns(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign);
    setFormName(campaign.name);
    setFormDescription(campaign.description || "");
    setFormBaseUrl(campaign.baseUrl || "");
  }

  async function handleSave() {
    if (!formName.trim()) { toast.error("Name is required"); return; }

    try {
      if (editingCampaign) {
        await campaignsApi.update(editingCampaign.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          baseUrl: formBaseUrl.trim() || undefined,
        });
        toast.success("Campaign updated");
        setEditingCampaign(null);
      } else {
        await campaignsApi.create(projectId, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          baseUrl: formBaseUrl.trim() || undefined,
          testCaseIds: [],
        });
        toast.success("Campaign created");
        setShowCreate(false);
      }
      setFormName("");
      setFormDescription("");
      setFormBaseUrl("");
      loadCampaigns();
    } catch {
      toast.error("Failed to save campaign");
    }
  }

  async function handleDelete(campaign: Campaign) {
    try {
      await campaignsApi.delete(campaign.id);
      toast.success("Campaign deleted");
      setDeleteConfirm(null);
      loadCampaigns();
    } catch {
      toast.error("Failed to delete campaign");
    }
  }

  async function handleRun(campaign: Campaign) {
    if (!campaign.baseUrl) {
      // Prompt for base URL
      setRunUrlDialog({ campaign });
      setRunUrl("");
      return;
    }
    try {
      const runId = await runCampaign(campaign.id);
      router.push(`/campaign-runs/${runId}`);
    } catch { /* toast handled inside runCampaign */ }
  }

  async function handleRunWithUrl() {
    if (!runUrlDialog) return;
    try {
      const runId = await runCampaign(runUrlDialog.campaign.id, runUrl.trim() || undefined);
      setRunUrlDialog(null);
      router.push(`/campaign-runs/${runId}`);
    } catch { /* toast handled inside runCampaign */ }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-muted-foreground">Loading campaigns…</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end p-4 pb-0">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">No campaigns yet. Select test cases on the project page to create one.</p>
              <Button variant="outline" onClick={() => router.push(`/projects/${projectId}/cases`)}>
                Go to Cases
              </Button>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/projects/${projectId}/campaigns/${campaign.id}`)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{campaign.name}</CardTitle>
                  {campaign.description && (
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => handleRun(campaign)} title="Run campaign">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}/campaigns/${campaign.id}`)} title="Edit campaign">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(campaign)} title="Delete campaign">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="secondary">{campaign.testCaseIds.length} test case{campaign.testCaseIds.length !== 1 ? 's' : ''}</Badge>
                  {campaign.baseUrl && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {campaign.baseUrl}
                    </span>
                  )}
                  {campaign.createdByName && <span>Created by {campaign.createdByName}</span>}
                  <span>{new Date(campaign.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Base URL (optional)</Label>
              <Input value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} placeholder="https://app-uat.example.com" />
              <p className="text-xs text-muted-foreground mt-1">
                Replaces the origin of the first navigation step when running tests.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleSave}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Base URL (optional)</Label>
              <Input value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)} placeholder="https://app-uat.example.com" />
              <p className="text-xs text-muted-foreground mt-1">
                Replaces the origin of the first navigation step when running tests.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingCampaign(null)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Run URL Dialog */}
      <Dialog open={!!runUrlDialog} onOpenChange={(open) => !open && setRunUrlDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Base URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This campaign has no base URL configured. Enter one to override the first navigation URL, or leave empty to use the original test case URLs.
            </p>
            <Input value={runUrl} onChange={(e) => setRunUrl(e.target.value)} placeholder="https://app-uat.example.com" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRunUrlDialog(null)}>Cancel</Button>
              <Button onClick={handleRunWithUrl}>
                <Play className="mr-2 h-4 w-4" /> Run
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
