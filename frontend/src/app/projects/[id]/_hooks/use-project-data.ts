/**
 * Custom hook that manages all data-fetching and state for the project detail page.
 *
 * Encapsulates project, test-case, feature/phase, visibility, and
 * project-access loading so the page component only needs to consume
 * the returned state and callbacks.
 *
 * @param projectId - The ID of the project to load.
 * @returns All state values, setter functions, and reload callbacks.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { projectsApi, usersApi, adminApi } from "@/lib/api";
import type { ProjectDetail, ProjectTestCase, Feature, Phase, GroupVisibility } from "@/types/api";
import type { GroupingMode } from "../_lib/group-builder";
import { toast } from "sonner";

export function useProjectData(projectId: string) {
  // ── Core data ──
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [testCases, setTestCases] = useState<ProjectTestCase[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [grouping, setGrouping] = useState<GroupingMode>("feature");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Visibility (hidden/collapsed groups) ──
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<GroupVisibility[]>([]);

  // ── Project-level user access ──
  const [projectAccess, setProjectAccess] = useState<
    { userId: string; name: string | null; email: string | null; image: string | null; role: { id: string; name: string; isAdmin: boolean } | null; grantedBy: string | null; grantedAt: string }[]
  >([]);

  // ── Dialog state ──
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignFPDialogOpen, setAssignFPDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "feature" | "phase";
    id: string;
    name: string;
  } | null>(null);

  // ── Form state ──
  const [newItemName, setNewItemName] = useState("");
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [assignSearchResults, setAssignSearchResults] = useState<
    { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }[]
  >([]);
  const [assignSelectedUsers, setAssignSelectedUsers] = useState<
    { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }[]
  >([]);
  const [bulkFeatureIds, setBulkFeatureIds] = useState<Set<string>>(new Set());
  const [bulkPhaseIds, setBulkPhaseIds] = useState<Set<string>>(new Set());
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<
    { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }[]
  >([]);
  const [editingGroup, setEditingGroup] = useState<{
    type: "feature" | "phase";
    id: string;
    name: string;
  } | null>(null);
  const [projectName, setProjectName] = useState("");

  // ── Data loaders ──

  /** Fetch project metadata and its test cases in parallel. */
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

  /** Load per-user group visibility preferences (hidden groups). */
  const loadVisibility = useCallback(async () => {
    try {
      const res = await projectsApi.getVisibility(projectId);
      setVisibility(res.data);
      const hidden = new Set<string>();
      for (const v of res.data) {
        if (v.isHidden) hidden.add(`${v.groupType}:${v.groupId}`);
      }
      setHiddenGroups(hidden);
    } catch { /* visibility is optional — fail silently */ }
  }, [projectId]);

  /** Load the list of users with explicit access to this project. */
  const loadProjectAccess = useCallback(async () => {
    try {
      const res = await adminApi.getProjectAccess(projectId);
      setProjectAccess(res.data);
    } catch { /* non-critical */ }
  }, [projectId]);

  // ── Effects ──

  /** Initial data load on mount. */
  useEffect(() => {
    loadProject();
    loadVisibility();
    loadProjectAccess();
  }, [loadProject, loadVisibility, loadProjectAccess]);

  /** Debounced user search for the bulk-assign dialog. */
  useEffect(() => {
    if (!assignDialogOpen) return;
    const timeout = setTimeout(async () => {
      try {
        setAssignSearchResults(
          (await usersApi.search(assignSearchQuery || undefined)).data,
        );
      } catch { /* search failure is non-fatal */ }
    }, 200);
    return () => clearTimeout(timeout);
  }, [assignSearchQuery, assignDialogOpen]);

  /** Debounced user search for the project-access dialog. */
  useEffect(() => {
    if (!usersDialogOpen) return;
    const timeout = setTimeout(async () => {
      try {
        setUserSearchResults(
          (await usersApi.search(userSearchQuery || undefined)).data,
        );
      } catch { /* non-fatal */ }
    }, 200);
    return () => clearTimeout(timeout);
  }, [userSearchQuery, usersDialogOpen]);

  /** Re-fetch test cases when the search query changes (debounced). */
  useEffect(() => {
    const timeout = setTimeout(() => loadProject(), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return {
    // Core data
    project, setProject, testCases, features, phases,
    grouping, setGrouping,
    search, setSearch, selected, setSelected,
    // Visibility
    hiddenGroups, setHiddenGroups, collapsedGroups, setCollapsedGroups, visibility,
    // Access
    projectAccess, setProjectAccess,
    // Dialogs
    featureDialogOpen, setFeatureDialogOpen,
    phaseDialogOpen, setPhaseDialogOpen,
    assignDialogOpen, setAssignDialogOpen,
    assignFPDialogOpen, setAssignFPDialogOpen,
    usersDialogOpen, setUsersDialogOpen,
    deleteProjectConfirm, setDeleteProjectConfirm,
    deleteTarget, setDeleteTarget,
    // Form state
    newItemName, setNewItemName,
    assignSearchQuery, setAssignSearchQuery,
    assignSearchResults, assignSelectedUsers, setAssignSelectedUsers,
    bulkFeatureIds, setBulkFeatureIds,
    bulkPhaseIds, setBulkPhaseIds,
    userSearchQuery, setUserSearchQuery,
    userSearchResults,
    editingGroup, setEditingGroup,
    projectName, setProjectName,
    // Loaders
    loadProject, loadProjectAccess,
  };
}
