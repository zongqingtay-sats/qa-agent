/**
 * Async action handlers for the flow editor.
 *
 * Each function encapsulates a complete workflow: save, validate,
 * AI refinement, or test execution. They operate on the flow state
 * provided by the caller and trigger toasts for user feedback.
 */

import type { Node, Edge } from "@xyflow/react";
import { toast } from "sonner";
import { testCasesApi, generateApi, testRunsApi } from "@/lib/api";
import type { StepResult, GeneratedTestCase } from "@/types/api";
import { runTestCase } from "@/lib/run-test";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";
import { buildFlowFromSteps } from "@/lib/flow-utils";
import { validateFlow } from "./flow-validation";

/** Common state accessors needed by all action handlers. */
export interface FlowActionDeps {
  testCaseId: string;
  nodes: Node[];
  edges: Edge[];
  testCaseName: string;
  testCaseDescription: string;
  testCasePreconditions: string;
  testCasePassingCriteria: string;
  testCaseTags: string[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setTestCaseName: React.Dispatch<React.SetStateAction<string>>;
  setTestCaseDescription: React.Dispatch<React.SetStateAction<string>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setRunning: React.Dispatch<React.SetStateAction<boolean>>;
  setRefining: React.Dispatch<React.SetStateAction<boolean>>;
  setLastRun: React.Dispatch<React.SetStateAction<{
    id: string; status: string; startedAt: string; stepResults: StepResult[];
  } | null>>;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  initialSnapshot: React.MutableRefObject<string>;
  currentSnapshot: string;
}

/**
 * Persist the current flow and metadata to the backend.
 *
 * Runs validation first — if valid the test case status is set to "active",
 * otherwise it stays as "draft".
 *
 * @param deps - Shared state accessors from the editor hook.
 */
export async function handleSave(deps: FlowActionDeps) {
  deps.setSaving(true);
  try {
    const validation = validateFlow(deps.nodes, deps.edges);
    const status = validation.valid ? "active" : "draft";
    await testCasesApi.update(deps.testCaseId, {
      name: deps.testCaseName,
      description: deps.testCaseDescription,
      preconditions: deps.testCasePreconditions,
      passingCriteria: deps.testCasePassingCriteria,
      tags: deps.testCaseTags,
      flowData: { nodes: deps.nodes, edges: deps.edges },
      status,
    });
    toast.success("Test case saved");
    deps.initialSnapshot.current = deps.currentSnapshot;
  } catch (err: any) {
    toast.error(err.message || "Failed to save");
  } finally {
    deps.setSaving(false);
  }
}

/**
 * Run flow validation and surface errors/warnings as toasts.
 *
 * @param nodes - Current nodes.
 * @param edges - Current edges.
 */
export function handleValidate(nodes: Node[], edges: Edge[]) {
  const result = validateFlow(nodes, edges);
  if (result.valid && result.warnings.length === 0) {
    toast.success("Flow is valid!");
  } else {
    result.errors.forEach((e) => toast.error(e));
    result.warnings.forEach((w) => toast.warning(w));
  }
}

/**
 * Send the current flow to the AI refinement endpoint.
 *
 * Scrapes navigate-target pages via the browser extension to provide
 * DOM context, then rebuilds the graph from the AI-refined steps.
 *
 * @param deps - Shared state from the editor hook.
 */
export async function handleRefine(deps: FlowActionDeps) {
  deps.setRefining(true);
  try {
    const firstNav = deps.nodes.find((n) => n.data?.blockType === "navigate");
    const baseUrl = ((firstNav?.data as Record<string, unknown>)?.url as string) || "";

    // Build a simplified step list for the AI
    const stepNodes = deps.nodes.filter(
      (n) => n.data?.blockType && n.data.blockType !== "start" && n.data.blockType !== "end",
    );
    const steps = stepNodes.map((n, i) => ({
      order: i + 1,
      action: (n.data as Record<string, unknown>).blockType as string,
      target: ((n.data as Record<string, unknown>).selector || (n.data as Record<string, unknown>).url) as string,
      value: ((n.data as Record<string, unknown>).value || (n.data as Record<string, unknown>).expectedValue) as string,
      description: ((n.data as Record<string, unknown>).description || (n.data as Record<string, unknown>).label) as string,
    }));

    const testCases: GeneratedTestCase[] = [
      { name: deps.testCaseName, description: deps.testCaseDescription, steps },
    ];

    // Scrape pages for context so the AI can produce accurate selectors
    const extensionId = getExtensionId();
    const pageContexts: { url: string; html: string }[] = [];

    if (extensionId) {
      const urls = new Set<string>();
      if (baseUrl) urls.add(baseUrl);
      for (const step of steps) {
        if (step.action === "navigate" && step.target) {
          try { urls.add(new URL(step.target, baseUrl || undefined).href); }
          catch { /* skip invalid URLs */ }
        }
      }
      if (urls.size > 0) {
        toast.info(`Scraping ${urls.size} page(s) for context...`);
        for (const url of urls) {
          try {
            const result = await scrapePageViaExtension(extensionId, url);
            if (result.html) pageContexts.push({ url, html: result.html });
          } catch { /* skip failed scrapes */ }
        }
      }
    }

    if (pageContexts.length === 0) {
      toast.info("No page context available — AI will refine based on step logic only");
    }

    const res = await generateApi.refine(
      testCases,
      pageContexts.length > 0 ? pageContexts : [{ url: baseUrl || "unknown", html: "" }],
      baseUrl || undefined,
    );
    const refined = res.data.testCases?.[0];
    if (!refined || !refined.steps?.length) {
      toast.warning("AI returned no refinements");
      return;
    }

    // Rebuild the graph from the refined steps
    const { nodes: newNodes, edges: newEdges } = buildFlowFromSteps(refined.steps);
    deps.setNodes(newNodes);
    deps.setEdges(newEdges);
    if (refined.name) deps.setTestCaseName(refined.name);
    if (refined.description) deps.setTestCaseDescription(refined.description);
    toast.success("Test case refined by AI");
  } catch (err: any) {
    toast.error(err.message || "Failed to refine test case");
  } finally {
    deps.setRefining(false);
  }
}

/**
 * Save the flow then execute it via the browser extension.
 *
 * After execution completes, fetches step results and applies
 * pass/fail highlights to the corresponding nodes. Auto-selects the
 * first failed node so the user can inspect it immediately.
 *
 * @param deps - Shared state from the editor hook.
 */
export async function handleRun(deps: FlowActionDeps) {
  deps.setRunning(true);
  // Clear previous execution highlights
  deps.setNodes((nds) =>
    nds.map((n) => {
      if (n.data?.executionStatus) {
        const { executionStatus, ...rest } = n.data as Record<string, unknown>;
        return { ...n, data: rest };
      }
      return n;
    }),
  );
  try {
    await handleSave(deps);
    await runTestCase(deps.testCaseId);

    // Fetch the latest run results and highlight nodes
    try {
      const runs = await testRunsApi.list({ testCaseId: deps.testCaseId });
      const latestRun = runs.data?.[0];
      if (latestRun?.id) {
        const runDetail = await testRunsApi.get(latestRun.id);
        const steps: StepResult[] = runDetail.data?.stepResults || [];

        deps.setLastRun({
          id: latestRun.id,
          status: runDetail.data?.status || latestRun.status,
          startedAt: runDetail.data?.startedAt || latestRun.startedAt,
          stepResults: steps,
        });

        if (steps.length > 0) {
          let failedNodeToSelect: Node | null = null;

          deps.setNodes((nds) =>
            nds.map((n) => {
              const step = [...steps]
                .reverse()
                .find((s: StepResult) => s.blockId === n.id && !s.retry);
              if (step) {
                if (step.status === "failed" && !failedNodeToSelect) {
                  failedNodeToSelect = { ...n, data: { ...n.data, executionStatus: step.status } };
                }
                return { ...n, data: { ...n.data, executionStatus: step.status } };
              }
              return n;
            }),
          );

          // Auto-select the first failed node for immediate inspection
          if (failedNodeToSelect) {
            deps.setSelectedNode(failedNodeToSelect);
          }
        }
      }
    } catch { /* Run result fetch is best-effort */ }
  } catch (err: any) {
    toast.error(err.message || "Failed to run test");
  } finally {
    deps.setRunning(false);
  }
}
