"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, use } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Users,
  Trash2,
  Layers,
  Milestone,
  X,
  FolderKanban,
} from "lucide-react";
import { projectsApi, testCasesApi, assignmentsApi, usersApi } from "@/lib/api";
import type { ProjectDetail, ProjectTestCase, Feature, Phase, GroupVisibility, Assignment } from "@/types/api";
import { toast } from "sonner";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";

type GroupingMode = "feature" | "phase" | "feature-phase" | "phase-feature";

interface GroupedSection {
  key: string;
  label: string;
  groupType: "feature" | "phase";
  groupId: string;
  items: ProjectTestCase[];
  subGroups?: { key: string; label: string; groupType: "feature" | "phase"; groupId: string; items: ProjectTestCase[] }[];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [testCases, setTestCases] = useState<ProjectTestCase[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [grouping, setGrouping] = useState<GroupingMode>("feature");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<GroupVisibility[]>([]);

  // Dialogs
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignFPDialogOpen, setAssignFPDialogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [assignSearchResults, setAssignSearchResults] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [assignSelectedUsers, setAssignSelectedUsers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [bulkFeatureIds, setBulkFeatureIds] = useState<Set<string>>(new Set());
  const [bulkPhaseIds, setBulkPhaseIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ type: "feature" | "phase"; id: string; name: string } | null>(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ type: "feature" | "phase"; id: string; name: string } | null>(null);
  const [projectName, setProjectName] = useState("");

  const loadProject = useCallback(async () => {
    try {
      const [projRes, tcRes] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.getTestCases(projectId, { search: search || undefined }),
      ]);
      setProject(projRes.data);
      setTestCases(tcRes.data);
      setFeatures(projRes.data.features || []);
      setPhases(projRes.data.phases || []);
      setProjectName(projRes.data.name || "");
    } catch {
      toast.error("Failed to load project");
    }
  }, [projectId, search]);

  const loadVisibility = useCallback(async () => {
    try {
      const res = await projectsApi.getVisibility(projectId);
      setVisibility(res.data);
      const hidden = new Set<string>();
      for (const v of res.data) {
        if (v.isHidden) hidden.add(`${v.groupType}:${v.groupId}`);
      }
      setHiddenGroups(hidden);
    } catch { }
  }, [projectId]);

  useEffect(() => { loadProject(); loadVisibility(); }, [loadProject, loadVisibility]);

  // Debounced user search for assign dialog
  useEffect(() => {
    if (!assignDialogOpen) return;
    const timeout = setTimeout(async () => {
      try { setAssignSearchResults((await usersApi.search(assignSearchQuery || undefined)).data); } catch { }
    }, 200);
    return () => clearTimeout(timeout);
  }, [assignSearchQuery, assignDialogOpen]);

  useEffect(() => {
    const timeout = setTimeout(() => loadProject(), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Grouping logic — M2M: a test case can appear in multiple groups
  function buildGroups(): GroupedSection[] {
    if (grouping === "feature") {
      return buildSingleLevel("feature", features, (tc) => tc.featureIds || []);
    }
    if (grouping === "phase") {
      return buildSingleLevel("phase", phases, (tc) => tc.phaseIds || []);
    }
    if (grouping === "feature-phase") {
      return buildTwoLevel("feature", features, (tc) => tc.featureIds || [], "phase", phases, (tc) => tc.phaseIds || []);
    }
    // phase-feature
    return buildTwoLevel("phase", phases, (tc) => tc.phaseIds || [], "feature", features, (tc) => tc.featureIds || []);
  }

  function buildSingleLevel(type: "feature" | "phase", groups: (Feature | Phase)[], getGroupIds: (tc: ProjectTestCase) => string[]): GroupedSection[] {
    const sections: GroupedSection[] = groups.map((g) => ({
      key: `${type}:${g.id}`,
      label: g.name,
      groupType: type,
      groupId: g.id,
      items: testCases.filter((tc) => getGroupIds(tc).includes(g.id)),
    }));
    const unassigned = testCases.filter((tc) => getGroupIds(tc).length === 0);
    if (unassigned.length > 0) {
      sections.push({ key: `${type}:unassigned`, label: "Unassigned", groupType: type, groupId: "unassigned", items: unassigned });
    }
    return sections;
  }

  function buildTwoLevel(
    outerType: "feature" | "phase", outerGroups: (Feature | Phase)[], getOuterIds: (tc: ProjectTestCase) => string[],
    innerType: "feature" | "phase", innerGroups: (Feature | Phase)[], getInnerIds: (tc: ProjectTestCase) => string[],
  ): GroupedSection[] {
    return outerGroups.map((outer) => {
      const outerItems = testCases.filter((tc) => getOuterIds(tc).includes(outer.id));
      const subGroups = innerGroups.map((inner) => ({
        key: `${innerType}:${inner.id}`,
        label: inner.name,
        groupType: innerType as "feature" | "phase",
        groupId: inner.id,
        items: outerItems.filter((tc) => getInnerIds(tc).includes(inner.id)),
      })).filter((sg) => sg.items.length > 0);
      const noInner = outerItems.filter((tc) => getInnerIds(tc).length === 0);
      if (noInner.length > 0) {
        subGroups.push({ key: `${innerType}:unassigned`, label: "Unassigned", groupType: innerType as "feature" | "phase", groupId: "unassigned", items: noInner });
      }
      return { key: `${outerType}:${outer.id}`, label: outer.name, groupType: outerType, groupId: outer.id, items: outerItems, subGroups };
    }).concat((() => {
      const unassigned = testCases.filter((tc) => getOuterIds(tc).length === 0);
      if (unassigned.length === 0) return [];
      return [{ key: `${outerType}:unassigned`, label: "Unassigned", groupType: outerType, groupId: "unassigned", items: unassigned, subGroups: [] }];
    })());
  }

  function toggleGroupVisibility(groupType: "feature" | "phase", groupId: string) {
    const key = `${groupType}:${groupId}`;
    const newHidden = new Set(hiddenGroups);
    const isHidden = !newHidden.has(key);
    if (isHidden) newHidden.add(key); else newHidden.delete(key);
    setHiddenGroups(newHidden);
    projectsApi.setVisibility(projectId, { groupType, groupId, isHidden }).catch(() => { });
  }

  function toggleCollapse(key: string) {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
    setCollapsedGroups(newSet);
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelected(newSet);
  }

  function toggleSelectAll() {
    if (selected.size === testCases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(testCases.map((tc) => tc.id)));
    }
  }

  async function handleCreateFeature() {
    if (!newItemName.trim()) return;
    try {
      await projectsApi.createFeature(projectId, { name: newItemName.trim() });
      toast.success("Feature created");
      setFeatureDialogOpen(false);
      setNewItemName("");
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleCreatePhase() {
    if (!newItemName.trim()) return;
    try {
      await projectsApi.createPhase(projectId, { name: newItemName.trim() });
      toast.success("Phase created");
      setPhaseDialogOpen(false);
      setNewItemName("");
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleBulkAssign() {
    if (assignSelectedUsers.length === 0 || selected.size === 0) return;
    try {
      await assignmentsApi.bulkAssign(
        Array.from(selected),
        assignSelectedUsers.map((u) => u.id),
        assignSelectedUsers.map((u) => u.name || undefined) as string[],
      );
      toast.success("Users assigned");
      setAssignDialogOpen(false);
      setAssignSelectedUsers([]);
      setAssignSearchQuery("");
      setSelected(new Set());
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    try {
      await Promise.all(Array.from(selected).map((id) => testCasesApi.delete(id)));
      toast.success(`${selected.size} test case(s) deleted`);
      setSelected(new Set());
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleBulkAssignFP() {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          testCasesApi.update(id, {
            featureIds: Array.from(bulkFeatureIds),
            phaseIds: Array.from(bulkPhaseIds),
          })
        )
      );
      toast.success(`${selected.size} test case(s) updated`);
      setAssignFPDialogOpen(false);
      setBulkFeatureIds(new Set());
      setBulkPhaseIds(new Set());
      setSelected(new Set());
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDeleteFeature(id: string) {
    try {
      await projectsApi.deleteFeature(id);
      toast.success("Feature deleted");
      setDeleteTarget(null);
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDeletePhase(id: string) {
    try {
      await projectsApi.deletePhase(id);
      toast.success("Phase deleted");
      setDeleteTarget(null);
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDeleteProject() {
    try {
      await projectsApi.delete(projectId);
      toast.success("Project deleted");
      router.push("/projects");
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleRenameProject() {
    const trimmed = projectName.trim();
    if (!trimmed || trimmed === project?.name) return;
    try {
      await projectsApi.update(projectId, { name: trimmed });
      setProject((p) => p ? ({ ...p, name: trimmed }) : p);
    } catch (e: any) { toast.error(e.message); setProjectName(project?.name || ""); }
  }

  async function handleRenameGroup(type: "feature" | "phase", id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) { setEditingGroup(null); return; }
    try {
      if (type === "feature") await projectsApi.updateFeature(id, { name: trimmed });
      else await projectsApi.updatePhase(id, { name: trimmed });
      setEditingGroup(null);
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  const groups = buildGroups();

  if (!project) {
    return (
      <>
        <PageHeader title="Loading..." />
        <div className="flex-1 p-4" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 shrink-0" />
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleRenameProject}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setProjectName(project?.name || ""); (e.target as HTMLInputElement).blur(); } }}
              className="bg-transparent border-none outline-none text-lg font-semibold w-full"
              placeholder="Project name..."
            />
          </span>
        }
        description={project.description || "Project detail"}
        actions={
          <div className="flex gap-2">
            <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                <Layers className="h-4 w-4 mr-1" /> Add Feature
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Feature</DialogTitle><DialogDescription>Create a new feature group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="feat-name">Name</Label><Input id="feat-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Authentication" /></div>
                <DialogFooter><Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>Cancel</Button><Button onClick={handleCreateFeature} disabled={!newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                <Milestone className="h-4 w-4 mr-1" /> Add Phase
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Phase</DialogTitle><DialogDescription>Create a new phase group.</DialogDescription></DialogHeader>
                <div className="py-2"><Label htmlFor="phase-name">Name</Label><Input id="phase-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Sprint 1" /></div>
                <DialogFooter><Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>Cancel</Button><Button onClick={handleCreatePhase} disabled={!newItemName.trim()}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" onClick={() => setDeleteProjectConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Project
            </Button>
          </div>
        }
      />
      <div className="flex-1 p-4 space-y-4">
        {/* Grouping toggle bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Group by:</span>
          {(["feature", "phase", "feature-phase", "phase-feature"] as GroupingMode[]).map((mode) => (
            <Button
              key={mode}
              variant={grouping === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setGrouping(mode)}
            >
              {mode === "feature" ? "Feature" : mode === "phase" ? "Phase" : mode === "feature-phase" ? "Feature → Phase" : "Phase → Feature"}
            </Button>
          ))}
        </div>

        {/* Search + batch actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search test cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) { setAssignSelectedUsers([]); setAssignSearchQuery(""); } }}>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Users className="h-4 w-4 mr-1" /> Assign
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign Users</DialogTitle><DialogDescription>Search and select users to assign to {selected.size} test case(s).</DialogDescription></DialogHeader>
                  <div className="py-2 space-y-3">
                    {assignSelectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {assignSelectedUsers.map((u) => (
                          <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                            {u.name || u.email}
                            <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => setAssignSelectedUsers((prev) => prev.filter((p) => p.id !== u.id))}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Command shouldFilter={false} className="rounded-md ring-1 ring-foreground/10">
                      <CommandInput placeholder="Search by name..." value={assignSearchQuery} onValueChange={setAssignSearchQuery} />
                      <CommandList>
                        {assignSearchResults.filter((u) => !assignSelectedUsers.some((s) => s.id === u.id)).length === 0 ? (
                          <CommandEmpty>No users found</CommandEmpty>
                        ) : (
                          assignSearchResults
                            .filter((u) => !assignSelectedUsers.some((s) => s.id === u.id))
                            .map((u) => (
                              <CommandItem key={u.id} onSelect={() => setAssignSelectedUsers((prev) => [...prev, u])}>
                                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                                  {(u.name || u.email)?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm truncate">{u.name || "Unnamed"}</span>
                                  {u.email && <span className="text-xs text-muted-foreground truncate">{u.email}</span>}
                                </div>
                              </CommandItem>
                            ))
                        )}
                      </CommandList>
                    </Command>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button><Button onClick={handleBulkAssign} disabled={assignSelectedUsers.length === 0}>Assign</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={assignFPDialogOpen} onOpenChange={(open) => { setAssignFPDialogOpen(open); if (!open) { setBulkFeatureIds(new Set()); setBulkPhaseIds(new Set()); } }}>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Layers className="h-4 w-4 mr-1" /> Feature / Phase
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign Feature / Phase</DialogTitle><DialogDescription>Select features and phases for {selected.size} test case(s).</DialogDescription></DialogHeader>
                  <div className="space-y-4 py-2">
                    {features.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Features</Label>
                        <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                          {features.map((f) => (
                            <label key={f.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <Checkbox checked={bulkFeatureIds.has(f.id)} onCheckedChange={() => { setBulkFeatureIds((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; }); }} />
                              <span className="text-sm">{f.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {phases.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Phases</Label>
                        <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                          {phases.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <Checkbox checked={bulkPhaseIds.has(p.id)} onCheckedChange={() => { setBulkPhaseIds((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; }); }} />
                              <span className="text-sm">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {features.length === 0 && phases.length === 0 && (
                      <p className="text-sm text-muted-foreground">No features or phases in this project yet.</p>
                    )}
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setAssignFPDialogOpen(false)}>Cancel</Button><Button onClick={handleBulkAssignFP}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
            </div>
          )}
        </div>

        {/* Grouped sections */}
        <div className="space-y-3">
          {groups.map((group) => {
            const isHidden = hiddenGroups.has(group.key);
            const isCollapsed = collapsedGroups.has(group.key);
            const visibleItems = isHidden ? [] : group.items;

            return (
              <Card key={group.key} className="p-0 gap-0">
                <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors">
                  <button type="button" className="flex items-center justify-center shrink-0" onClick={() => toggleCollapse(group.key)}>
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {editingGroup?.id === group.groupId && editingGroup?.type === group.groupType ? (
                    <input
                      className="font-medium flex-1 bg-transparent border-b border-primary outline-none text-sm"
                      value={editingGroup.name}
                      onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      onBlur={() => handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name);
                        if (e.key === "Escape") setEditingGroup(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="font-medium flex-1 cursor-default"
                      onDoubleClick={() => { if (group.groupId !== "unassigned") setEditingGroup({ type: group.groupType, id: group.groupId, name: group.label }); }}
                    >{group.label}</span>
                  )}
                  <Badge variant="secondary">{group.items.length}</Badge>
                  {isHidden && <span className="text-xs text-muted-foreground">{group.items.length} hidden</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(group.groupType, group.groupId); }}
                    title={isHidden ? "Show" : "Hide"}
                  >
                    {isHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {group.groupId !== "unassigned" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: group.groupType, id: group.groupId, name: group.label }); }}
                      title={`Delete ${group.groupType}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!isCollapsed && !isHidden && (
                  <CardContent className="pt-0 pb-3">
                    {group.subGroups && group.subGroups.length > 0 ? (
                      <div className="pt-3 space-y-3">
                        {group.subGroups.map((sub) => {
                          const subHidden = hiddenGroups.has(sub.key);
                          const subCollapsed = collapsedGroups.has(sub.key);
                          return (
                            <div key={sub.key} className="rounded-md ring-1 ring-foreground/10">
                              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                                <button type="button" className="flex items-center justify-center shrink-0" onClick={() => toggleCollapse(sub.key)}>
                                  {subCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                {editingGroup?.id === sub.groupId && editingGroup?.type === sub.groupType ? (
                                  <input
                                    className="text-sm font-medium flex-1 bg-transparent border-b border-primary outline-none"
                                    value={editingGroup.name}
                                    onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                    onBlur={() => handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name);
                                      if (e.key === "Escape") setEditingGroup(null);
                                    }}
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    className="text-sm font-medium flex-1 cursor-default"
                                    onDoubleClick={() => { if (sub.groupId !== "unassigned") setEditingGroup({ type: sub.groupType, id: sub.groupId, name: sub.label }); }}
                                  >{sub.label}</span>
                                )}
                                <Badge variant="secondary" className="text-xs">{sub.items.length}</Badge>
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(sub.groupType, sub.groupId); }}
                                >
                                  {subHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                              {!subCollapsed && !subHidden && (
                                <div className="px-3 pb-2">
                                  <TestCaseRows items={sub.items} selected={selected} toggleSelect={toggleSelect} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <TestCaseRows items={visibleItems} selected={selected} toggleSelect={toggleSelect} />
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Delete feature/phase confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type === "feature" ? "Feature" : "Phase"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This will not delete any test cases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "feature") handleDeleteFeature(deleteTarget.id);
                else handleDeletePhase(deleteTarget.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete project confirmation */}
      <Dialog open={deleteProjectConfirm} onOpenChange={setDeleteProjectConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{project?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TestCaseRows({ items, selected, toggleSelect }: { items: ProjectTestCase[]; selected: Set<string>; toggleSelect: (id: string) => void }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground py-2">No test cases</p>;
  return (
    <div className="space-y-1">
      {items.map((tc) => (
        <div key={tc.id} className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-muted/30">
          <Checkbox checked={selected.has(tc.id)} onCheckedChange={() => toggleSelect(tc.id)} />
          <Link href={`/test-cases/${tc.id}`} className="flex-1 text-sm font-medium truncate">
            {tc.name}
          </Link>

          {tc.assignments && tc.assignments.length > 0 && (
            <div className="flex -space-x-2">
              {tc.assignments.slice(0, 3).map((a: Assignment, i: number) => (
                <div key={i} className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center border-2 border-background" title={a.userName || a.userId}>
                  {(a.userName || a.userId)?.[0]?.toUpperCase() || "?"}
                </div>
              ))}
              {tc.assignments.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center border-2 border-background">
                  +{tc.assignments.length - 3}
                </div>
              )}
            </div>
          )}
          {tc.lastRunStatus && <StatusBadge status={tc.lastRunStatus} size="sm" />}
          <StatusBadge status={tc.status} size="sm" />
        </div>
      ))}
    </div>
  );
}
