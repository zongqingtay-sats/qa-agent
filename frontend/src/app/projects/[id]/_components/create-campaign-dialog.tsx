/**
 * Dialog for creating a new campaign from selected test cases.
 *
 * @module create-campaign-dialog
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { campaignsApi } from "@/lib/api";
import { toast } from "sonner";

export interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  testCaseIds: string[];
  onCreated?: () => void;
}

export function CreateCampaignDialog({ open, onOpenChange, projectId, testCaseIds, onCreated }: CreateCampaignDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await campaignsApi.create(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
        testCaseIds,
      });
      onOpenChange(false);
      setName("");
      setDescription("");
      setBaseUrl("");
      toast.success("Campaign created");
      onCreated?.();
      router.push(`/projects/${projectId}/campaigns`);
    } catch {
      toast.error("Failed to create campaign");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-1/2">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Create a campaign from the {testCaseIds.length} selected test case{testCaseIds.length !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. UAT Regression Suite" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Base URL (optional)</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app-uat.example.com" />
            <p className="text-xs text-muted-foreground mt-1">
              Overrides the origin of the first navigation step when running.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
