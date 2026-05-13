/**
 * "Add Test Case" dialog for a project group (feature/phase).
 *
 * Shows 3 options:
 * 1. Add existing test case (opens sub-dialog with search)
 * 2. Create new test case (navigates to editor with project/feature/phase pre-set)
 * 3. Generate test case (navigates to generate page with context params)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPlus, Plus, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

import { testCasesApi } from "@/lib/api";
import type { TestCase } from "@/types/api";

interface AddTestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The feature/phase context for this group. */
  groupType: "feature" | "phase";
  groupId: string;
  groupLabel: string;
  /** Called after test cases are added to refresh the project data. */
  onAdded: () => void;
}

export function AddTestCaseDialog({
  open, onOpenChange, projectId, groupType, groupId, groupLabel, onAdded,
}: AddTestCaseDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "existing">("menu");

  // Reset to menu when dialog opens
  useEffect(() => { if (open) setMode("menu"); }, [open]);

  function handleCreateNew() {
    onOpenChange(false);
    // Navigate to create new test case with project context as URL params
    const params = new URLSearchParams({
      projectId,
      ...(groupType === "feature" ? { featureId: groupId } : { phaseId: groupId }),
    });
    router.push(`/test-cases/new?${params.toString()}`);
  }

  function handleGenerate() {
    onOpenChange(false);
    const params = new URLSearchParams({
      projectId,
      ...(groupType === "feature" ? { featureId: groupId } : { phaseId: groupId }),
    });
    router.push(`/generate?${params.toString()}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Test Case</DialogTitle>
          <DialogDescription>
            Add a test case to <strong>{groupLabel}</strong>
          </DialogDescription>
        </DialogHeader>

        {mode === "menu" ? (
          <div className="grid gap-3 py-2">
            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => setMode("existing")}>
              <ListPlus className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Add existing test case</div>
                <div className="text-xs text-muted-foreground">Assign an unassigned test case to this group</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={handleCreateNew}>
              <Plus className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Create new test case</div>
                <div className="text-xs text-muted-foreground">Create a blank test case in this group</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3 px-4" onClick={handleGenerate}>
              <Sparkles className="h-5 w-5 mr-3 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Generate test case</div>
                <div className="text-xs text-muted-foreground">Use AI to generate and auto-assign to this group</div>
              </div>
            </Button>
          </div>
        ) : (
          <AddExistingPanel
            projectId={projectId} groupType={groupType} groupId={groupId}
            onAdded={() => { onOpenChange(false); onAdded(); }}
            onBack={() => setMode("menu")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-panel: Add existing test cases ───────────────────────────────

function AddExistingPanel({
  projectId, groupType, groupId, onAdded, onBack,
}: {
  projectId: string;
  groupType: "feature" | "phase";
  groupId: string;
  onAdded: () => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all cases not already in this project
      const res = await testCasesApi.list({ search: search || undefined });
      // Filter to only show cases NOT assigned to this project
      const unassigned = res.data.filter((tc) => !tc.projectId || tc.projectId !== projectId);
      // Sort by updatedAt descending
      unassigned.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setCases(unassigned);
    } catch {
      toast.error("Failed to load test cases");
    } finally {
      setLoading(false);
    }
  }, [search, projectId]);

  useEffect(() => { loadCases(); }, [loadCases]);

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      for (const id of selected) {
        const update: Record<string, unknown> = { projectId };
        if (groupType === "feature") update.featureIds = [groupId];
        else update.phaseIds = [groupId];
        await testCasesApi.update(id, update as any);
      }
      toast.success(`Added ${selected.size} test case(s)`);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign test cases");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search test cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <ScrollArea className="h-75 border rounded-md">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : cases.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No unassigned test cases found.
          </div>
        ) : (
          <div className="divide-y">
            {cases.map((tc) => (
              <label key={tc.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(tc.id)} onCheckedChange={() => toggleSelect(tc.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(tc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{tc.status}</Badge>
              </label>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>Cancel</Button>
        <Button size="sm" onClick={handleAssign} disabled={selected.size === 0 || saving}>
          {saving ? "Adding..." : `Add ${selected.size || ""} test case${selected.size !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
