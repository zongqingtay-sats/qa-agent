"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectsApi, testCasesApi } from "@/lib/api";
import { toast } from "sonner";

interface AssignProjectDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** IDs of test cases to assign. If single, pre-fills current values. */
  testCaseIds: string[];
  /** Pre-selected project ID (for single test case) */
  currentProjectId?: string;
  /** Pre-selected feature IDs (for single test case) */
  currentFeatureIds?: string[];
  /** Pre-selected phase IDs (for single test case) */
  currentPhaseIds?: string[];
  /** Called after successful assignment */
  onAssigned?: () => void;
}

export function AssignProjectDialog({
  open,
  onOpenChange,
  testCaseIds,
  currentProjectId,
  currentFeatureIds = [],
  currentPhaseIds = [],
  onAssigned,
}: AssignProjectDialogProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Load projects list on open
  useEffect(() => {
    if (!open) return;
    projectsApi.list().then((res) => setProjects(res.data)).catch(() => {});
  }, [open]);

  // Pre-fill current values when dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedProjectId(currentProjectId || "");
    setSelectedFeatureIds(new Set(currentFeatureIds));
    setSelectedPhaseIds(new Set(currentPhaseIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load features/phases when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setFeatures([]);
      setPhases([]);
      return;
    }
    Promise.all([
      projectsApi.getFeatures(selectedProjectId),
      projectsApi.getPhases(selectedProjectId),
    ]).then(([fRes, pRes]) => {
      setFeatures(fRes.data);
      setPhases(pRes.data);
      // Remove selections that don't belong to this project
      setSelectedFeatureIds((prev) => {
        const validIds = new Set(fRes.data.map((f: any) => f.id));
        return new Set([...prev].filter((id) => validIds.has(id)));
      });
      setSelectedPhaseIds((prev) => {
        const validIds = new Set(pRes.data.map((p: any) => p.id));
        return new Set([...prev].filter((id) => validIds.has(id)));
      });
    }).catch(() => {});
  }, [selectedProjectId]);

  function toggleFeature(id: string) {
    setSelectedFeatureIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function togglePhase(id: string) {
    setSelectedPhaseIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function handleSave() {
    if (testCaseIds.length === 0) return;
    setSaving(true);
    try {
      const projectId = selectedProjectId && selectedProjectId !== "__none__" ? selectedProjectId : null;
      const updates: any = {
        projectId,
        featureIds: projectId ? Array.from(selectedFeatureIds) : [],
        phaseIds: projectId ? Array.from(selectedPhaseIds) : [],
      };
      await Promise.all(
        testCaseIds.map((id) => testCasesApi.update(id, updates))
      );
      toast.success(
        testCaseIds.length === 1
          ? "Test case updated"
          : `${testCaseIds.length} test case(s) updated`
      );
      onOpenChange(false);
      onAssigned?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const isBulk = testCaseIds.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBulk ? `Assign ${testCaseIds.length} Test Cases` : "Assign to Project"}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? "Select project, features, and phases for the selected test cases."
              : "Select a project, then pick features and phases."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Project selector */}
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={selectedProjectId} onValueChange={(v) => setSelectedProjectId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project...">
                  {selectedProjectId === "__none__"
                    ? "— None —"
                    : projects.find((p) => p.id === selectedProjectId)?.name || "Select a project..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Features (checkboxes) */}
          {selectedProjectId && selectedProjectId !== "__none__" && features.length > 0 && (
            <div className="space-y-1.5">
              <Label>Features</Label>
              <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                {features.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <Checkbox
                      checked={selectedFeatureIds.has(f.id)}
                      onCheckedChange={() => toggleFeature(f.id)}
                    />
                    <span className="text-sm">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Phases (checkboxes) */}
          {selectedProjectId && selectedProjectId !== "__none__" && phases.length > 0 && (
            <div className="space-y-1.5">
              <Label>Phases</Label>
              <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                {phases.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <Checkbox
                      checked={selectedPhaseIds.has(p.id)}
                      onCheckedChange={() => togglePhase(p.id)}
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedProjectId && selectedProjectId !== "__none__" && features.length === 0 && phases.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This project has no features or phases yet. Create them from the project page.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
