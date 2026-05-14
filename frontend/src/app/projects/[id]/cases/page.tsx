/**
 * Project cases page.
 *
 * Displays test cases organised into collapsible groups by feature/phase.
 * Supports bulk operations, inline renaming, group visibility toggling,
 * and project-level user access management.
 */

"use client";

import { use, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search, Layers, Milestone, Group,
} from "lucide-react";

import { useProjectData } from "../_hooks/use-project-data";
import { useProjectActions } from "../_hooks/use-project-actions";
import { buildGroups, type GroupingMode } from "../_lib/group-builder";
import { GroupSection } from "../_components/group-section";
import { BatchActionsBar } from "../_components/batch-actions-bar";
import { AddTestCaseDialog } from "../_components/add-test-case-dialog";
import { CreateCampaignDialog } from "../_components/create-campaign-dialog";

export default function ProjectCasesPage({ params }: { params: Promise<{ id: string; }>; }) {
  const { id: projectId } = use(params);
  const data = useProjectData(projectId);
  const actions = useProjectActions({ projectId, ...data });
  const groups = buildGroups(data.grouping, data.testCases, data.features, data.phases);

  // Add test case dialog state
  const [addTCDialogOpen, setAddTCDialogOpen] = useState(false);
  const [addTCContext, setAddTCContext] = useState<{ groupType: "feature" | "phase"; groupId: string; groupLabel: string; parentGroupType?: "feature" | "phase"; parentGroupId?: string; }>({ groupType: "feature", groupId: "", groupLabel: "" });

  // Campaign creation dialog state
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  function handleAddTestCase(groupType: "feature" | "phase", groupId: string, groupLabel: string, parentGroupType?: "feature" | "phase", parentGroupId?: string) {
    setAddTCContext({ groupType, groupId, groupLabel, parentGroupType, parentGroupId });
    setAddTCDialogOpen(true);
  }

  if (!data.project) {
    return <div className="flex-1 p-4 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <>
      <div className="flex-1 p-4 space-y-4">
        <div className="flex justify-between">
          {/* ── Grouping toggle ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <div title="Group by">
              <Group className="w-4 h-4 text-muted-foreground" />
            </div>
            {(["feature", "phase", "feature-phase", "phase-feature"] as GroupingMode[]).map((mode) => (
              <Button key={mode} variant={data.grouping === mode ? "default" : "outline"} size="sm" onClick={() => data.setGrouping(mode)}>
                {mode === "feature" ? "Feature" : mode === "phase" ? "Phase" : mode === "feature-phase" ? "Feature → Phase" : "Phase → Feature"}
              </Button>
            ))}
          </div>
          {/* ── Toolbar: Add Feature/Phase ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <Dialog open={data.featureDialogOpen} onOpenChange={data.setFeatureDialogOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}><Layers className="h-4 w-4 mr-1" /> Add Feature</DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Feature</DialogTitle><DialogDescription>Create a new feature group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="feat-name">Name</Label><Input id="feat-name" value={data.newItemName} onChange={(e) => data.setNewItemName(e.target.value)} placeholder="e.g. Login" /></div>
                <DialogFooter><Button variant="outline" onClick={() => data.setFeatureDialogOpen(false)}>Cancel</Button><Button onClick={actions.handleCreateFeature} disabled={!data.newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={data.phaseDialogOpen} onOpenChange={data.setPhaseDialogOpen}>
              <DialogTrigger render={<Button variant="outline" size="sm" />}><Milestone className="h-4 w-4 mr-1" /> Add Phase</DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Phase</DialogTitle><DialogDescription>Create a new phase group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="phase-name">Name</Label><Input id="phase-name" value={data.newItemName} onChange={(e) => data.setNewItemName(e.target.value)} placeholder="e.g. Sprint 1" /></div>
                <DialogFooter><Button variant="outline" onClick={() => data.setPhaseDialogOpen(false)}>Cancel</Button><Button onClick={actions.handleCreatePhase} disabled={!data.newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Search + batch actions ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search test cases..." value={data.search} onChange={(e) => data.setSearch(e.target.value)} className="pl-9" />
          </div>
          <BatchActionsBar
            selectedCount={data.selected.size}
            assignDialogOpen={data.assignDialogOpen} setAssignDialogOpen={data.setAssignDialogOpen}
            assignSelectedUsers={data.assignSelectedUsers} setAssignSelectedUsers={data.setAssignSelectedUsers}
            assignSearchQuery={data.assignSearchQuery} setAssignSearchQuery={data.setAssignSearchQuery}
            assignSearchResults={data.assignSearchResults} onBulkAssign={actions.handleBulkAssign}
            assignFPDialogOpen={data.assignFPDialogOpen} setAssignFPDialogOpen={data.setAssignFPDialogOpen}
            features={data.features} phases={data.phases}
            bulkFeatureIds={data.bulkFeatureIds} setBulkFeatureIds={data.setBulkFeatureIds}
            bulkPhaseIds={data.bulkPhaseIds} setBulkPhaseIds={data.setBulkPhaseIds}
            onBulkAssignFP={actions.handleBulkAssignFP} onDeleteSelected={actions.handleDeleteSelected}
            onRunSelected={actions.handleRunSelected}
            onExportSelected={actions.handleExportSelected}
            onCreateCampaign={() => setCampaignDialogOpen(true)}
          />
        </div>

        {/* ── Grouped sections ── */}
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupSection
              key={group.key} group={group}
              hiddenGroups={data.hiddenGroups} collapsedGroups={data.collapsedGroups}
              selected={data.selected} setSelected={data.setSelected} editingGroup={data.editingGroup} setEditingGroup={data.setEditingGroup}
              toggleCollapse={actions.toggleCollapse} toggleGroupVisibility={actions.toggleGroupVisibility}
              toggleSelect={actions.toggleSelect} handleRenameGroup={actions.handleRenameGroup}
              setDeleteTarget={data.setDeleteTarget}
              onAddTestCase={handleAddTestCase}
            />
          ))}
        </div>
      </div>

      {/* ── Delete feature/phase confirmation ── */}
      <Dialog open={!!data.deleteTarget} onOpenChange={(open) => { if (!open) data.setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {data.deleteTarget?.type === "feature" ? "Feature" : "Phase"}</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{data.deleteTarget?.name}&rdquo;? This will not delete any test cases.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => data.setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!data.deleteTarget) return;
              if (data.deleteTarget.type === "feature") actions.handleDeleteFeature(data.deleteTarget.id);
              else actions.handleDeletePhase(data.deleteTarget.id);
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add test case dialog ── */}
      <AddTestCaseDialog
        open={addTCDialogOpen}
        onOpenChange={setAddTCDialogOpen}
        projectId={projectId}
        groupType={addTCContext.groupType}
        groupId={addTCContext.groupId}
        groupLabel={addTCContext.groupLabel}
        parentGroupType={addTCContext.parentGroupType}
        parentGroupId={addTCContext.parentGroupId}
        onAdded={data.loadProject}
      />

      {/* ── Create campaign dialog ── */}
      <CreateCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        projectId={projectId}
        testCaseIds={Array.from(data.selected)}
        onCreated={() => data.setSelected(new Set())}
      />
    </>
  );
}
