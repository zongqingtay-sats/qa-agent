/**
 * Load a test case's flow data and latest run results.
 *
 * Extracted from `use-flow-editor` to keep the hook under 200 lines.
 *
 * @module flow-loader
 */

import type { Node, Edge } from "@xyflow/react";
import type { StepResult, FlowNode } from "@/types/api";
import { testCasesApi, testRunsApi } from "@/lib/api";
import { blockTypeToNodeType } from "../_components/block-config";

/** Return value of {@link loadFlowData}. */
export interface FlowLoadResult {
  name: string;
  description: string;
  preconditions: string;
  passingCriteria: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
  nodeIdCounter: number;
  lastRun: { id: string; status: string; startedAt: string; stepResults: StepResult[] } | null;
}

/**
 * Fetch a test case by ID and its latest run, returning parsed flow data.
 *
 * If the test case doesn't exist (new), a default placeholder flow is returned.
 *
 * @param testCaseId - The test case to load.
 * @returns Parsed flow state ready to hydrate into the editor.
 */
export async function loadFlowData(testCaseId: string): Promise<FlowLoadResult> {
  let name = "New Test Case";
  let description = "";
  let preconditions = "";
  let passingCriteria = "";
  let tags: string[] = [];
  let flowNodes: Node[] = [];
  let flowEdges: Edge[] = [];
  let counter = 0;

  try {
    const tc = (await testCasesApi.get(testCaseId)).data;
    name = tc.name;
    description = tc.description || "";
    preconditions = tc.preconditions || "";
    passingCriteria = tc.passingCriteria || "";
    tags = tc.tags || [];

    let flowData;
    try { flowData = typeof tc.flowData === "string" ? JSON.parse(tc.flowData) : tc.flowData; }
    catch { flowData = { nodes: [], edges: [] }; }

    if (flowData.nodes?.length > 0) {
      flowNodes = flowData.nodes.map((n: FlowNode) => ({
        ...n, type: n.type || blockTypeToNodeType(n.data?.blockType || "actionNode"),
      }));
      counter = flowData.nodes.length + 1;
    }
    if (flowData.edges?.length > 0) flowEdges = flowData.edges;
  } catch {
    // New test case — default placeholder flow
    flowNodes = [
      { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
      { id: "navigate-1", type: "actionNode", position: { x: 250, y: 170 }, data: { label: "Navigate to URL", blockType: "navigate", url: "" } },
      { id: "assert-1", type: "assertNode", position: { x: 250, y: 290 }, data: { label: "Assert", blockType: "assert", assertionType: "element-exists" } },
      { id: "end-1", type: "endNode", position: { x: 250, y: 410 }, data: { label: "End", blockType: "end" } },
    ];
    flowEdges = [
      { id: "e-start-nav", source: "start-1", target: "navigate-1", animated: true },
      { id: "e-assert-end", source: "assert-1", target: "end-1", animated: true },
    ];
    counter = 4;
  }

  // Load latest run for inline result highlighting
  let lastRun: FlowLoadResult["lastRun"] = null;
  try {
    const runs = await testRunsApi.list({ testCaseId });
    const latestRun = runs.data?.[0];
    if (latestRun?.id) {
      const runDetail = await testRunsApi.get(latestRun.id);
      const steps: StepResult[] = runDetail.data?.stepResults || [];
      lastRun = {
        id: latestRun.id,
        status: runDetail.data?.status || latestRun.status,
        startedAt: runDetail.data?.startedAt || latestRun.startedAt,
        stepResults: steps,
      };
      // Apply execution status highlights
      if (steps.length > 0) {
        flowNodes = flowNodes.map((n) => {
          const step = [...steps].reverse().find((s: StepResult) => s.blockId === n.id && !s.retry);
          return step ? { ...n, data: { ...n.data, executionStatus: step.status } } : n;
        });
      }
    }
  } catch { /* No previous runs */ }

  return { name, description, preconditions, passingCriteria, tags, nodes: flowNodes, edges: flowEdges, nodeIdCounter: counter, lastRun };
}
