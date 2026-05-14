/**
 * Action handlers for the project detail page.
 *
 * Contains all mutation logic: creating/deleting features and phases,
 * bulk-assigning users and feature/phases, renaming, deleting the project,
 * and toggling group visibility/collapse state.
 *
 * Each function is a standalone async handler that calls the relevant API
 * and updates local state via the provided setters.
 */

import { useRouter } from "next/navigation";
import { projectsApi, testCasesApi, assignmentsApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { toast } from "sonner";
import type { ProjectDetail, Feature, Phase } from "@/types/api";

/** Props expected by `useProjectActions`. All come from `useProjectData`. */
interface ProjectActionDeps {
  projectId: string;
  project: ProjectDetail | null;
  setProject: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  hiddenGroups: Set<string>;
  setHiddenGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  collapsedGroups: Set<string>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  newItemName: string;
  setNewItemName: React.Dispatch<React.SetStateAction<string>>;
  setFeatureDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPhaseDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  assignSelectedUsers: { id: string; name: string | null; email: string | null }[];
  setAssignSelectedUsers: React.Dispatch<React.SetStateAction<{ id: string; name: string | null; email: string | null }[]>>;
  setAssignDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAssignSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  bulkFeatureIds: Set<string>;
  setBulkFeatureIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  bulkPhaseIds: Set<string>;
  setBulkPhaseIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAssignFPDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteTarget: React.Dispatch<React.SetStateAction<{ type: "feature" | "phase"; id: string; name: string } | null>>;
  projectName: string;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  editingGroup: { type: "feature" | "phase"; id: string; name: string } | null;
  setEditingGroup: React.Dispatch<React.SetStateAction<{ type: "feature" | "phase"; id: string; name: string } | null>>;
  loadProject: () => Promise<void>;
  testCases: { id: string }[];
}

/**
 * Build all action handlers for the project detail page.
 *
 * @param deps - State values and setters from the `useProjectData` hook.
 * @returns An object of handler functions consumed by the page component.
 */
export function useProjectActions(deps: ProjectActionDeps) {
  const router = useRouter();
  const {
    projectId, project, setProject,
    selected, setSelected,
    hiddenGroups, setHiddenGroups,
    collapsedGroups, setCollapsedGroups,
    newItemName, setNewItemName,
    setFeatureDialogOpen, setPhaseDialogOpen,
    assignSelectedUsers, setAssignSelectedUsers,
    setAssignDialogOpen, setAssignSearchQuery,
    bulkFeatureIds, setBulkFeatureIds,
    bulkPhaseIds, setBulkPhaseIds,
    setAssignFPDialogOpen, setDeleteTarget,
    projectName, setProjectName,
    setEditingGroup,
    loadProject, testCases,
  } = deps;

  // ── Visibility / selection toggles ──

  /** Toggle the hidden state of a group and persist it server-side. */
  function toggleGroupVisibility(groupType: "feature" | "phase", groupId: string) {
    const key = `${groupType}:${groupId}`;
    const newHidden = new Set(hiddenGroups);
    const isHidden = !newHidden.has(key);
    if (isHidden) newHidden.add(key); else newHidden.delete(key);
    setHiddenGroups(newHidden);
    projectsApi.setVisibility(projectId, { groupType, groupId, isHidden }).catch(() => {});
  }

  /** Toggle collapse state for a group key. */
  function toggleCollapse(key: string) {
    const s = new Set(collapsedGroups);
    if (s.has(key)) s.delete(key); else s.add(key);
    setCollapsedGroups(s);
  }

  /** Toggle selection state for a single test case. */
  function toggleSelect(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  /** Select or deselect all test cases. */
  function toggleSelectAll() {
    if (selected.size === testCases.length) setSelected(new Set());
    else setSelected(new Set(testCases.map((tc) => tc.id)));
  }

  // ── Feature / Phase CRUD ──

  /** Create a new feature in the current project. */
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

  /** Create a new phase in the current project. */
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

  /** Delete a feature by ID. */
  async function handleDeleteFeature(id: string) {
    try {
      await projectsApi.deleteFeature(id);
      toast.success("Feature deleted");
      setDeleteTarget(null);
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  /** Delete a phase by ID. */
  async function handleDeletePhase(id: string) {
    try {
      await projectsApi.deletePhase(id);
      toast.success("Phase deleted");
      setDeleteTarget(null);
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Bulk operations ──

  /** Assign selected users to all selected test cases. */
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

  /** Delete all selected test cases. */
  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    try {
      await Promise.all(Array.from(selected).map((id) => testCasesApi.delete(id)));
      toast.success(`${selected.size} test case(s) deleted`);
      setSelected(new Set());
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  /** Run all selected test cases sequentially. */
  async function handleRunSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    toast.info(`Running ${ids.length} test case(s)...`);
    for (const id of ids) {
      try {
        await runTestCase(id);
      } catch (e: any) {
        toast.error(`Failed to run test case: ${e.message}`);
      }
    }
    setSelected(new Set());
    loadProject();
  }

  /** Export all selected test cases in the chosen format. */
  async function handleExportSelected(format: "json" | "docx" | "pdf") {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    toast.info(`Exporting ${ids.length} test case(s) as ${format.toUpperCase()}...`);
    try {
      const { exportApi } = await import("@/lib/api");
      for (const id of ids) {
        const blob = await exportApi.testCase(id, format);
        const filename = `test-case-${id.slice(0, 8)}.${format}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${ids.length} test case(s) as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export test cases");
    }
  }

  /** Bulk-assign feature/phase IDs to all selected test cases. */
  async function handleBulkAssignFP() {
    if (selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          testCasesApi.update(id, {
            featureIds: Array.from(bulkFeatureIds),
            phaseIds: Array.from(bulkPhaseIds),
          }),
        ),
      );
      toast.success(`${selected.size} test case(s) updated`);
      setAssignFPDialogOpen(false);
      setBulkFeatureIds(new Set());
      setBulkPhaseIds(new Set());
      setSelected(new Set());
      loadProject();
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Project-level operations ──

  /** Delete the entire project and redirect to the projects list. */
  async function handleDeleteProject() {
    try {
      await projectsApi.delete(projectId);
      toast.success("Project deleted");
      router.push("/projects");
    } catch (e: any) { toast.error(e.message); }
  }

  /** Rename the project if the value changed. */
  async function handleRenameProject() {
    const trimmed = projectName.trim();
    if (!trimmed || trimmed === project?.name) return;
    try {
      await projectsApi.update(projectId, { name: trimmed });
      setProject((p) => (p ? { ...p, name: trimmed } : p));
    } catch (e: any) {
      toast.error(e.message);
      setProjectName(project?.name || "");
    }
  }

  /** Rename a feature or phase group inline. */
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

  return {
    toggleGroupVisibility, toggleCollapse,
    toggleSelect, toggleSelectAll,
    handleCreateFeature, handleCreatePhase,
    handleDeleteFeature, handleDeletePhase,
    handleBulkAssign, handleDeleteSelected, handleRunSelected, handleExportSelected, handleBulkAssignFP,
    handleDeleteProject, handleRenameProject, handleRenameGroup,
  };
}
