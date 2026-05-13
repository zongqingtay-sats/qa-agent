/**
 * Data-fetching and inline-edit handlers for the test case detail page.
 *
 * Loads the test case and its recent runs, then provides commit handlers
 * for each editable field (name, description, preconditions, passing
 * criteria, tags).  Each commit function calls the API and optimistically
 * updates local state.
 *
 * @param testCaseId - The ID of the test case to load.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { testCasesApi, testRunsApi } from "@/lib/api";
import type { TestCase, TestRunListItem } from "@/types/api";
import { toast } from "sonner";

export function useTestCaseDetail(testCaseId: string) {
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [runs, setRuns] = useState<TestRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);

  // Editable form inputs
  const [tagsInput, setTagsInput] = useState("");
  const [testCaseName, setTestCaseName] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [preconditionsInput, setPreconditionsInput] = useState("");
  const [passingCriteriaInput, setPassingCriteriaInput] = useState("");

  /** Fetch the test case and its run history in parallel. */
  const load = useCallback(async () => {
    try {
      const [tcRes, runsRes] = await Promise.all([
        testCasesApi.get(testCaseId),
        testRunsApi.list({ testCaseId }),
      ]);
      setTestCase(tcRes.data);
      setTestCaseName(tcRes.data.name || "");
      setDescriptionInput(tcRes.data.description || "");
      setPreconditionsInput(tcRes.data.preconditions || "");
      setPassingCriteriaInput(tcRes.data.passingCriteria || "");
      setTagsInput((tcRes.data.tags || []).join(", "));
      setRuns(runsRes.data);
    } catch {
      toast.error("Failed to load test case");
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => { load(); }, [load]);

  // ── Field commit handlers ──
  // Each handler trims the value, checks if it changed, calls the API,
  // and optimistically updates the local test case state.

  /** Persist description on blur. */
  const handleDescriptionCommit = async () => {
    const trimmed = descriptionInput.trim();
    if (trimmed === (testCase?.description || "")) return;
    try {
      await testCasesApi.update(testCaseId, { description: trimmed || undefined });
      setTestCase((prev) => prev ? ({ ...prev, description: trimmed || undefined }) : prev);
    } catch {
      toast.error("Failed to update description");
      setDescriptionInput(testCase?.description || "");
    }
  };

  /** Persist preconditions on blur. */
  const handlePreconditionsCommit = async () => {
    const trimmed = preconditionsInput.trim();
    if (trimmed === (testCase?.preconditions || "")) return;
    try {
      await testCasesApi.update(testCaseId, { preconditions: trimmed || undefined });
      setTestCase((prev) => prev ? ({ ...prev, preconditions: trimmed || undefined }) : prev);
    } catch {
      toast.error("Failed to update preconditions");
      setPreconditionsInput(testCase?.preconditions || "");
    }
  };

  /** Persist passing criteria on blur. */
  const handlePassingCriteriaCommit = async () => {
    const trimmed = passingCriteriaInput.trim();
    if (trimmed === (testCase?.passingCriteria || "")) return;
    try {
      await testCasesApi.update(testCaseId, { passingCriteria: trimmed || undefined });
      setTestCase((prev) => prev ? ({ ...prev, passingCriteria: trimmed || undefined }) : prev);
    } catch {
      toast.error("Failed to update passing criteria");
      setPassingCriteriaInput(testCase?.passingCriteria || "");
    }
  };

  /** Persist test case name on blur. */
  const handleNameCommit = async () => {
    const trimmed = testCaseName.trim();
    if (!trimmed || trimmed === testCase?.name) return;
    try {
      await testCasesApi.update(testCaseId, { name: trimmed });
      setTestCase((prev) => prev ? ({ ...prev, name: trimmed }) : prev);
    } catch {
      toast.error("Failed to update name");
      setTestCaseName(testCase?.name || "");
    }
  };

  /** Persist comma-separated tags on blur. */
  const handleTagsCommit = async () => {
    const newTags = tagsInput.split(",").map((t: string) => t.trim()).filter(Boolean);
    const currentTags = testCase?.tags || [];
    if (JSON.stringify(newTags) === JSON.stringify(currentTags)) return;
    try {
      await testCasesApi.update(testCaseId, { tags: newTags });
      setTestCase((prev) => prev ? ({ ...prev, tags: newTags }) : prev);
    } catch {
      toast.error("Failed to update tags");
      setTagsInput(currentTags.join(", "));
    }
  };

  return {
    testCase, runs, loading, load,
    assignDialogOpen, setAssignDialogOpen,
    deleteDialogOpen, setDeleteDialogOpen,
    running, setRunning,
    // Form inputs
    tagsInput, setTagsInput,
    testCaseName, setTestCaseName,
    descriptionInput, setDescriptionInput,
    preconditionsInput, setPreconditionsInput,
    passingCriteriaInput, setPassingCriteriaInput,
    // Commit handlers
    handleDescriptionCommit, handlePreconditionsCommit,
    handlePassingCriteriaCommit, handleNameCommit, handleTagsCommit,
  };
}
