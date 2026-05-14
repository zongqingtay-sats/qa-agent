/**
 * Project detail page.
 *
 * Displays a single project with its test cases organised into
 * collapsible groups. Supports bulk operations, inline renaming,
 * group visibility toggling, and project-level user access management.
 *
 * Heavy rendering is delegated to extracted components:
 * - {@link GroupSection}      — per-group card with sub-groups
 * - {@link BatchActionsBar}   — bulk assign / delete toolbar
 * - {@link ProjectUsersDialog} — access management dialog
 * - {@link TestCaseRows}      — per-row rendering
 */

"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Users, Trash2, Layers, Milestone, FolderKanban, MoreVertical,
  Group,
} from "lucide-react";

import { useProjectData } from "./_hooks/use-project-data";
import { useProjectActions } from "./_hooks/use-project-actions";
import { buildGroups, type GroupingMode } from "./_lib/group-builder";
import { ProjectUsersDialog } from "./_components/project-users-dialog";
import { GroupSection } from "./_components/group-section";
import { BatchActionsBar } from "./_components/batch-actions-bar";
import { AddTestCaseDialog } from "./_components/add-test-case-dialog";
import { CreateCampaignDialog } from "./_components/create-campaign-dialog";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string; }>; }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const data = useProjectData(projectId);
  const actions = useProjectActions({ projectId, ...data });
  const groups = buildGroups(data.grouping, data.testCases, data.features, data.phases);

  useBreadcrumbLabel(projectId, data.projectName || undefined);

  // Add test case dialog state
  const [addTCDialogOpen, setAddTCDialogOpen] = useState(false);
  const [addTCContext, setAddTCContext] = useState<{ groupType: "feature" | "phase"; groupId: string; groupLabel: string; }>({ groupType: "feature", groupId: "", groupLabel: "" });

  // Campaign creation dialog state
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

  function handleAddTestCase(groupType: "feature" | "phase", groupId: string, groupLabel: string) {
    setAddTCContext({ groupType, groupId, groupLabel });
    setAddTCDialogOpen(true);
  }

  if (!data.project) {
    return (<><PageHeader title="Loading..." /><div className="flex-1 p-4" /></>);
  }

  return (
    <>
      {/* ── Header ── */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 shrink-0" />
            <input
              value={data.projectName}
              onChange={(e) => data.setProjectName(e.target.value)}
              onBlur={actions.handleRenameProject}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { data.setProjectName(data.project?.name || ""); (e.target as HTMLInputElement).blur(); }
              }}
              className="bg-transparent border-none outline-none text-lg font-semibold w-full"
              placeholder="Project name..."
            />
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { data.setUserSearchQuery(""); data.setUsersDialogOpen(true); }}>
              <Users className="h-4 w-4 mr-1" /> {data.projectAccess.length}
            </Button>
            {/* Add Feature */}
            <Dialog open={data.featureDialogOpen} onOpenChange={data.setFeatureDialogOpen}>
              <DialogTrigger render={<Button variant="outline" />}><Layers className="h-4 w-4 mr-1" /> Add Feature</DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Feature</DialogTitle><DialogDescription>Create a new feature group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="feat-name">Name</Label><Input id="feat-name" value={data.newItemName} onChange={(e) => data.setNewItemName(e.target.value)} placeholder="e.g. Login" /></div>
                <DialogFooter><Button variant="outline" onClick={() => data.setFeatureDialogOpen(false)}>Cancel</Button><Button onClick={actions.handleCreateFeature} disabled={!data.newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Add Phase */}
            <Dialog open={data.phaseDialogOpen} onOpenChange={data.setPhaseDialogOpen}>
              <DialogTrigger render={<Button variant="outline" />}><Milestone className="h-4 w-4 mr-1" /> Add Phase</DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Phase</DialogTitle><DialogDescription>Create a new phase group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="phase-name">Name</Label><Input id="phase-name" value={data.newItemName} onChange={(e) => data.setNewItemName(e.target.value)} placeholder="e.g. Sprint 1" /></div>
                <DialogFooter><Button variant="outline" onClick={() => data.setPhaseDialogOpen(false)}>Cancel</Button><Button onClick={actions.handleCreatePhase} disabled={!data.newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}/campaigns`)}>
                  <FolderKanban className="h-4 w-4 mr-2" /> Campaigns
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => data.setDeleteProjectConfirm(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex-1 p-4 space-y-4">
        {/* ── Grouping toggle ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Group by:</span>
          {(["feature", "phase", "feature-phase", "phase-feature"] as GroupingMode[]).map((mode) => (
            <Button key={mode} variant={data.grouping === mode ? "default" : "outline"} size="sm" onClick={() => data.setGrouping(mode)}>
              {mode === "feature" ? "Feature" : mode === "phase" ? "Phase" : mode === "feature-phase" ? "Feature → Phase" : "Phase → Feature"}
            </Button>
          ))}
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

      <ProjectUsersDialog
        open={data.usersDialogOpen} onOpenChange={data.setUsersDialogOpen}
        projectId={projectId} projectAccess={data.projectAccess} setProjectAccess={data.setProjectAccess}
        userSearchQuery={data.userSearchQuery} setUserSearchQuery={data.setUserSearchQuery}
        userSearchResults={data.userSearchResults}
      />

      {/* ── Delete project confirmation ── */}
      <Dialog open={data.deleteProjectConfirm} onOpenChange={data.setDeleteProjectConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{data.project?.name}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => data.setDeleteProjectConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={actions.handleDeleteProject}>Delete</Button>
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
